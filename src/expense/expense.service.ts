import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateExpenseInput = {
  companyId: number;
  categoryId?: number | null;
  amount: string;
  date: Date;
  description?: string | null;
  createdById?: number | null;
};

type UpdateExpenseInput = {
  categoryId?: number | null;
  amount?: string;
  date?: Date;
  description?: string | null;
};

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    return this.prisma.expense.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: { email: true },
        },
      },
    });
  }

  async create(companyId: number, userId: number, input: CreateExpenseInput) {
    await this.ensureMember(companyId, userId);
    await this.ensureCategory(companyId, input.categoryId);
    return this.prisma.expense.create({
      data: {
        companyId: input.companyId,
        categoryId: input.categoryId ?? null,
        amount: new Prisma.Decimal(input.amount),
        date: input.date,
        description: input.description ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  async update(companyId: number, expenseId: number, userId: number, input: UpdateExpenseInput) {
    await this.ensureMember(companyId, userId);
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.companyId !== companyId) {
      throw new NotFoundException('Expense not found.');
    }

    await this.ensureCategory(companyId, input.categoryId);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        categoryId: input.categoryId ?? undefined,
        amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
        date: input.date,
        description: input.description,
      },
    });
  }

  async remove(companyId: number, expenseId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    const expense = await this.prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.companyId !== companyId) {
      throw new NotFoundException('Expense not found.');
    }
    await this.prisma.expense.delete({ where: { id: expenseId } });
    return { ok: true };
  }

  private async ensureMember(companyId: number, userId: number) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied for this company.');
    }
    return membership;
  }

  private async ensureCategory(companyId: number, categoryId?: number | null) {
    if (!categoryId) {
      return;
    }
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.companyId !== companyId) {
      throw new NotFoundException('Category not found.');
    }
  }
}

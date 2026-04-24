import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateIncomeInput = {
  companyId: number;
  categoryId?: number | null;
  amount: string;
  date: Date;
  description?: string | null;
  createdById?: number | null;
};

type UpdateIncomeInput = {
  categoryId?: number | null;
  amount?: string;
  date?: Date;
  description?: string | null;
};

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    return this.prisma.income.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: { email: true },
        },
      },
    });
  }

  async create(companyId: number, userId: number, input: CreateIncomeInput) {
    await this.ensureMember(companyId, userId);
    await this.ensureCategory(companyId, input.categoryId);
    return this.prisma.income.create({
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

  async update(companyId: number, incomeId: number, userId: number, input: UpdateIncomeInput) {
    await this.ensureMember(companyId, userId);
    const income = await this.prisma.income.findUnique({ where: { id: incomeId } });
    if (!income || income.companyId !== companyId) {
      throw new NotFoundException('Income not found.');
    }

    await this.ensureCategory(companyId, input.categoryId);

    return this.prisma.income.update({
      where: { id: incomeId },
      data: {
        categoryId: input.categoryId ?? undefined,
        amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
        date: input.date,
        description: input.description,
      },
    });
  }

  async remove(companyId: number, incomeId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    const income = await this.prisma.income.findUnique({ where: { id: incomeId } });
    if (!income || income.companyId !== companyId) {
      throw new NotFoundException('Income not found.');
    }
    await this.prisma.income.delete({ where: { id: incomeId } });
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

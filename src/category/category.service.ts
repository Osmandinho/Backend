import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateCategoryInput = {
  companyId: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
};

type UpdateCategoryInput = {
  name?: string;
  type?: 'INCOME' | 'EXPENSE';
};

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    return this.prisma.category.findMany({
      where: { companyId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  async create(companyId: number, userId: number, input: CreateCategoryInput) {
    await this.ensureMember(companyId, userId);
    return this.prisma.category.create({
      data: {
        companyId: input.companyId,
        name: input.name,
        type: input.type,
      },
    });
  }

  async update(companyId: number, categoryId: number, userId: number, input: UpdateCategoryInput) {
    await this.ensureMember(companyId, userId);
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.companyId !== companyId) {
      throw new NotFoundException('Category not found.');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        name: input.name,
        type: input.type,
      },
    });
  }

  async remove(companyId: number, categoryId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.companyId !== companyId) {
      throw new NotFoundException('Category not found.');
    }
    await this.prisma.category.delete({ where: { id: categoryId } });
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

  static parseType(value?: string) {
    if (value === 'INCOME' || value === 'EXPENSE') {
      return value;
    }
    throw new BadRequestException('Category type must be INCOME or EXPENSE.');
  }
}

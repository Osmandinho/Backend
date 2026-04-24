import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateCompanyInput = {
  name: string;
  ownerId: number;
};

type UpdateCompanyInput = {
  name?: string;
};

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: number) {
    return this.prisma.company.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateCompanyInput) {
    return this.prisma.company.create({
      data: {
        name: input.name,
        members: {
          create: {
            userId: input.ownerId,
            role: 'ADMIN',
          },
        },
      },
    });
  }

  async getById(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found.');
    }
    return company;
  }

  async update(companyId: number, userId: number, input: UpdateCompanyInput) {
    await this.ensureMember(companyId, userId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
      },
    });
  }

  async remove(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    await this.prisma.company.delete({ where: { id: companyId } });
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
}

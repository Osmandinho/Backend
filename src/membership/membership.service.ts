import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CreateMemberInput = {
  companyId: number;
  email: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'EMPLOYEE';
};

type UpdateMemberInput = {
  role: 'ADMIN' | 'ACCOUNTANT' | 'EMPLOYEE';
};

@Injectable()
export class MembershipService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    return this.prisma.membership.findMany({
      where: { companyId },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(userId: number, input: CreateMemberInput) {
    await this.ensureAdmin(input.companyId, userId);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    if (user.id === userId && input.role !== 'ADMIN') {
      throw new BadRequestException('Admin cannot downgrade themselves here.');
    }
    const existing = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: input.companyId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('User is already a member of this company.');
    }
    return this.prisma.membership.create({
      data: {
        companyId: input.companyId,
        userId: user.id,
        role: input.role,
      },
    });
  }

  async updateMember(userId: number, companyId: number, memberId: number, input: UpdateMemberInput) {
    await this.ensureAdmin(companyId, userId);
    const membership = await this.prisma.membership.findUnique({
      where: { id: memberId },
    });
    if (!membership || membership.companyId !== companyId) {
      throw new NotFoundException('Membership not found.');
    }
    if (membership.userId === userId && input.role !== 'ADMIN') {
      throw new BadRequestException('Admin cannot downgrade themselves.');
    }
    return this.prisma.membership.update({
      where: { id: memberId },
      data: { role: input.role },
    });
  }

  async removeMember(userId: number, companyId: number, memberId: number) {
    await this.ensureAdmin(companyId, userId);
    const membership = await this.prisma.membership.findUnique({
      where: { id: memberId },
    });
    if (!membership || membership.companyId !== companyId) {
      throw new NotFoundException('Membership not found.');
    }
    if (membership.userId === userId) {
      throw new BadRequestException('Owner cannot remove themselves.');
    }
    await this.prisma.membership.delete({ where: { id: memberId } });
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

  private async ensureAdmin(companyId: number, userId: number) {
    const membership = await this.ensureMember(companyId, userId);
    if (membership.role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can manage members.');
    }
    return membership;
  }
}

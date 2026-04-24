import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ROLES_KEY, RoleName } from './roles.decorator';

type AuthRequest = Request & { user?: { sub: string; email: string } };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new ForbiddenException('Invalid user.');
    }

    const companyId = this.extractCompanyId(request);
    if (!companyId) {
      throw new ForbiddenException('Missing companyId for role check.');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
      select: { role: true },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied for this company.');
    }

    if (!requiredRoles.includes(membership.role as RoleName)) {
      throw new ForbiddenException('Insufficient role for this action.');
    }

    return true;
  }

  private extractCompanyId(request: AuthRequest): number | null {
    const param = request.params?.companyId;
    if (!param) {
      return null;
    }
    const companyId = Number.parseInt(param, 10);
    if (!Number.isFinite(companyId)) {
      return null;
    }
    return companyId;
  }
}

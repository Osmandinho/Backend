import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { MembershipService } from './membership.service';

type AuthRequest = Request & { user?: { sub: string; email: string } };

type CreateMemberBody = {
  email?: string;
  role?: string;
};

type UpdateMemberBody = {
  role?: string;
};

const parseId = (value: string, label: string) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id)) {
    throw new BadRequestException(`${label} must be a number.`);
  }
  return id;
};

const parseRole = (value?: string) => {
  if (value === 'ADMIN' || value === 'ACCOUNTANT' || value === 'EMPLOYEE') {
    return value;
  }
  throw new BadRequestException('Role must be ADMIN, ACCOUNTANT, or EMPLOYEE.');
};

@UseGuards(JwtAuthGuard)
@Controller()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('companies/:companyId/members')
  async list(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.membershipService.list(parseId(companyId, 'CompanyId'), userId);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Post('companies/:companyId/members')
  async add(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Body() body: CreateMemberBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required.');
    }
    const role = parseRole(body.role);
    return this.membershipService.addMember(userId, {
      companyId: parseId(companyId, 'CompanyId'),
      email,
      role,
    });
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Patch('companies/:companyId/members/:memberId')
  async update(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    const role = parseRole(body.role);
    return this.membershipService.updateMember(
      userId,
      parseId(companyId, 'CompanyId'),
      parseId(memberId, 'MemberId'),
      { role },
    );
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Delete('companies/:companyId/members/:memberId')
  async remove(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.membershipService.removeMember(
      userId,
      parseId(companyId, 'CompanyId'),
      parseId(memberId, 'MemberId'),
    );
  }
}

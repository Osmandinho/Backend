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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompanyService } from './company.service';
import type { Request } from 'express';

type AuthRequest = Request & { user?: { sub: string; email: string } };

type CreateCompanyBody = {
  name?: string;
};

type UpdateCompanyBody = {
  name?: string;
};

const parseId = (value: string, label: string) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id)) {
    throw new BadRequestException(`${label} must be a number.`);
  }
  return id;
};

@UseGuards(JwtAuthGuard)
@Controller()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('companies')
  async list(@Req() request: AuthRequest) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.companyService.listForUser(userId);
  }

  @Post('companies')
  async create(@Req() request: AuthRequest, @Body() body: CreateCompanyBody) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Company name is required.');
    }

    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    return this.companyService.create({ name, ownerId: userId });
  }

  @Get('companies/:companyId')
  async get(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.companyService.getById(parseId(companyId, 'CompanyId'), userId);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Patch('companies/:companyId')
  async update(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Body() body: UpdateCompanyBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Company name is required.');
    }

    return this.companyService.update(parseId(companyId, 'CompanyId'), userId, { name });
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Delete('companies/:companyId')
  async remove(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.companyService.remove(parseId(companyId, 'CompanyId'), userId);
  }
}

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
import { CategoryService } from './category.service';
import type { Request } from 'express';

type AuthRequest = Request & { user?: { sub: string; email: string } };

type CreateCategoryBody = {
  name?: string;
  type?: string;
};

type UpdateCategoryBody = {
  name?: string;
  type?: string;
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
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('companies/:companyId/categories')
  async list(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.categoryService.list(parseId(companyId, 'CompanyId'), userId);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Post('companies/:companyId/categories')
  async create(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Body() body: CreateCategoryBody,
  ) {
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Category name is required.');
    }
    const type = CategoryService.parseType(body.type);

    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    const id = parseId(companyId, 'CompanyId');
    return this.categoryService.create(id, userId, { companyId: id, name, type });
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Patch('companies/:companyId/categories/:categoryId')
  async update(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    const name = body.name?.trim();
    const type = body.type ? CategoryService.parseType(body.type) : undefined;
    if (!name && !type) {
      throw new BadRequestException('Nothing to update.');
    }

    return this.categoryService.update(
      parseId(companyId, 'CompanyId'),
      parseId(categoryId, 'CategoryId'),
      userId,
      { name, type },
    );
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Delete('companies/:companyId/categories/:categoryId')
  async remove(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('categoryId') categoryId: string,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.categoryService.remove(
      parseId(companyId, 'CompanyId'),
      parseId(categoryId, 'CategoryId'),
      userId,
    );
  }
}

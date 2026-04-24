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
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { IncomeService } from './income.service';
import type { Request, Response } from 'express';

type AuthRequest = Request & { user?: { sub: string; email: string } };

type CreateIncomeBody = {
  amount?: string | number;
  date?: string;
  description?: string;
  categoryId?: number | null;
};

type UpdateIncomeBody = {
  amount?: string | number;
  date?: string;
  description?: string | null;
  categoryId?: number | null;
};

const parseId = (value: string, label: string) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id)) {
    throw new BadRequestException(`${label} must be a number.`);
  }
  return id;
};

const parseAmount = (value?: string | number) => {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException('Amount is required.');
  }
  const text = String(value);
  if (Number.isNaN(Number.parseFloat(text))) {
    throw new BadRequestException('Amount must be a number.');
  }
  return text;
};

const parseDate = (value?: string) => {
  if (!value) {
    throw new BadRequestException('Date is required.');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Date must be a valid ISO string.');
  }
  return date;
};

const csvEscape = (value: string) => {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const toCsv = (headers: string[], rows: string[][]) => {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(cell)).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
};

@UseGuards(JwtAuthGuard)
@Controller()
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get('companies/:companyId/incomes')
  async list(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.incomeService.list(parseId(companyId, 'CompanyId'), userId);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Get('companies/:companyId/incomes/export')
  async exportCsv(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    const id = parseId(companyId, 'CompanyId');
    const items = await this.incomeService.list(id, userId);
    const headers = [
      'id',
      'amount',
      'date',
      'description',
      'categoryId',
      'createdByEmail',
      'createdAt',
    ];
    const rows = items.map((item) => [
      String(item.id),
      String(item.amount),
      item.date ? new Date(item.date).toISOString() : '',
      item.description ?? '',
      item.categoryId ? String(item.categoryId) : '',
      item.createdBy?.email ?? '',
      item.createdAt ? new Date(item.createdAt).toISOString() : '',
    ]);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="incomes-${id}.csv"`);
    return toCsv(headers, rows);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Post('companies/:companyId/incomes')
  async create(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Body() body: CreateIncomeBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    const id = parseId(companyId, 'CompanyId');
    return this.incomeService.create(id, userId, {
      companyId: id,
      amount: parseAmount(body.amount),
      date: parseDate(body.date),
      description: body.description?.trim() || null,
      categoryId: body.categoryId ?? null,
      createdById: userId,
    });
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Patch('companies/:companyId/incomes/:incomeId')
  async update(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('incomeId') incomeId: string,
    @Body() body: UpdateIncomeBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    const updates = {
      amount: body.amount !== undefined ? parseAmount(body.amount) : undefined,
      date: body.date ? parseDate(body.date) : undefined,
      description: body.description ?? undefined,
      categoryId: body.categoryId ?? undefined,
    };

    if (
      updates.amount === undefined &&
      updates.date === undefined &&
      updates.description === undefined &&
      updates.categoryId === undefined
    ) {
      throw new BadRequestException('Nothing to update.');
    }

    return this.incomeService.update(
      parseId(companyId, 'CompanyId'),
      parseId(incomeId, 'IncomeId'),
      userId,
      updates,
    );
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN')
  @Delete('companies/:companyId/incomes/:incomeId')
  async remove(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('incomeId') incomeId: string,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.incomeService.remove(
      parseId(companyId, 'CompanyId'),
      parseId(incomeId, 'IncomeId'),
      userId,
    );
  }
}

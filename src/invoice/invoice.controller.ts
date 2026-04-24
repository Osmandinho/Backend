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
import { InvoiceService } from './invoice.service';
import type { Request, Response } from 'express';

type AuthRequest = Request & { user?: { sub: string; email: string } };

type CreateInvoiceBody = {
  number?: string;
  title?: string;
  amount?: string | number;
  currency?: string;
  issuedAt?: string;
  dueDate?: string;
  description?: string;
  fileUrl?: string;
};

type UpdateInvoiceBody = {
  number?: string | null;
  title?: string;
  amount?: string | number;
  currency?: string | null;
  issuedAt?: string;
  dueDate?: string;
  description?: string | null;
  status?: 'OPEN' | 'PAID' | 'CANCELLED';
  paidAt?: string | null;
  paidNote?: string | null;
  fileUrl?: string | null;
};

type PayInvoiceBody = {
  note?: string;
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

const parseDate = (value?: string, label?: string) => {
  if (!value) {
    throw new BadRequestException(`${label ?? 'Date'} is required.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label ?? 'Date'} must be a valid ISO string.`);
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
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('companies/:companyId/invoices')
  async list(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.invoiceService.list(parseId(companyId, 'CompanyId'), userId);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Get('companies/:companyId/invoices/export')
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
    const items = await this.invoiceService.list(id, userId);
    const headers = [
      'id',
      'number',
      'title',
      'amount',
      'currency',
      'issuedAt',
      'dueDate',
      'status',
      'paidAt',
      'paidNote',
      'description',
      'createdByEmail',
      'createdAt',
    ];
    const rows = items.map((item) => [
      String(item.id),
      item.number ?? '',
      item.title ?? '',
      String(item.amount),
      item.currency ?? '',
      item.issuedAt ? new Date(item.issuedAt).toISOString() : '',
      item.dueDate ? new Date(item.dueDate).toISOString() : '',
      item.status ?? '',
      item.paidAt ? new Date(item.paidAt).toISOString() : '',
      item.paidNote ?? '',
      item.description ?? '',
      item.createdBy?.email ?? '',
      item.createdAt ? new Date(item.createdAt).toISOString() : '',
    ]);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="invoices-${id}.csv"`);
    return toCsv(headers, rows);
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Post('companies/:companyId/invoices')
  async create(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Body() body: CreateInvoiceBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    if (!body.title?.trim()) {
      throw new BadRequestException('Title is required.');
    }

    const id = parseId(companyId, 'CompanyId');
    return this.invoiceService.create(id, userId, {
      companyId: id,
      number: body.number?.trim() || null,
      title: body.title.trim(),
      amount: parseAmount(body.amount),
      currency: body.currency?.trim() || null,
      issuedAt: parseDate(body.issuedAt, 'IssuedAt'),
      dueDate: parseDate(body.dueDate, 'DueDate'),
      description: body.description?.trim() || null,
      fileUrl: body.fileUrl?.trim() || null,
      createdById: userId,
    });
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Patch('companies/:companyId/invoices/:invoiceId')
  async update(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: UpdateInvoiceBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }

    const updates = {
      number: body.number,
      title: body.title?.trim(),
      amount: body.amount !== undefined ? parseAmount(body.amount) : undefined,
      currency: body.currency,
      issuedAt: body.issuedAt ? parseDate(body.issuedAt, 'IssuedAt') : undefined,
      dueDate: body.dueDate ? parseDate(body.dueDate, 'DueDate') : undefined,
      description: body.description ?? undefined,
      status: body.status,
      paidAt: body.paidAt === null ? null : body.paidAt ? parseDate(body.paidAt, 'PaidAt') : undefined,
      paidNote: body.paidNote ?? undefined,
      fileUrl: body.fileUrl ?? undefined,
    };

    if (
      updates.number === undefined &&
      updates.title === undefined &&
      updates.amount === undefined &&
      updates.currency === undefined &&
      updates.issuedAt === undefined &&
      updates.dueDate === undefined &&
      updates.description === undefined &&
      updates.status === undefined &&
      updates.paidAt === undefined &&
      updates.paidNote === undefined &&
      updates.fileUrl === undefined
    ) {
      throw new BadRequestException('Nothing to update.');
    }

    return this.invoiceService.update(
      parseId(companyId, 'CompanyId'),
      parseId(invoiceId, 'InvoiceId'),
      userId,
      updates,
    );
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Post('companies/:companyId/invoices/:invoiceId/pay')
  async pay(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: PayInvoiceBody,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.invoiceService.markPaid(
      parseId(companyId, 'CompanyId'),
      parseId(invoiceId, 'InvoiceId'),
      userId,
      body.note?.trim() || null,
    );
  }

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Delete('companies/:companyId/invoices/:invoiceId')
  async remove(
    @Req() request: AuthRequest,
    @Param('companyId') companyId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.invoiceService.remove(
      parseId(companyId, 'CompanyId'),
      parseId(invoiceId, 'InvoiceId'),
      userId,
    );
  }
}

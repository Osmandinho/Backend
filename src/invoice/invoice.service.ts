import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type CreateInvoiceInput = {
  companyId: number;
  number?: string | null;
  title: string;
  amount: string;
  currency?: string | null;
  issuedAt: Date;
  dueDate: Date;
  description?: string | null;
  fileUrl?: string | null;
  createdById?: number | null;
};

type UpdateInvoiceInput = {
  number?: string | null;
  title?: string;
  amount?: string;
  currency?: string | null;
  issuedAt?: Date;
  dueDate?: Date;
  description?: string | null;
  status?: 'OPEN' | 'PAID' | 'CANCELLED';
  paidAt?: Date | null;
  paidNote?: string | null;
  fileUrl?: string | null;
};

@Injectable()
export class InvoiceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    return this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: { email: true },
        },
      },
    });
  }

  async create(companyId: number, userId: number, input: CreateInvoiceInput) {
    await this.ensureMember(companyId, userId);
    return this.prisma.invoice.create({
      data: {
        companyId: input.companyId,
        number: input.number ?? null,
        title: input.title,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency ?? 'CZK',
        issuedAt: input.issuedAt,
        dueDate: input.dueDate,
        description: input.description ?? null,
        fileUrl: input.fileUrl ?? null,
        createdById: input.createdById ?? null,
      },
    });
  }

  async update(
    companyId: number,
    invoiceId: number,
    userId: number,
    input: UpdateInvoiceInput,
  ) {
    await this.ensureMember(companyId, userId);
    const invoice = await this.findInvoice(companyId, invoiceId);
    return this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        number: input.number,
        title: input.title,
        amount: input.amount ? new Prisma.Decimal(input.amount) : undefined,
        currency: input.currency ?? undefined,
        issuedAt: input.issuedAt,
        dueDate: input.dueDate,
        description: input.description,
        status: input.status,
        paidAt: input.paidAt === undefined ? undefined : input.paidAt,
        paidNote: input.paidNote,
        fileUrl: input.fileUrl,
      },
    });
  }

  async markPaid(
    companyId: number,
    invoiceId: number,
    userId: number,
    note?: string | null,
  ) {
    await this.ensureMember(companyId, userId);
    const invoice = await this.findInvoice(companyId, invoiceId);
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paidNote: note ?? null,
      },
    });
    return { ok: true, message: 'Invoice marked as paid.' };
  }

  async remove(companyId: number, invoiceId: number, userId: number) {
    await this.ensureMember(companyId, userId);
    const invoice = await this.findInvoice(companyId, invoiceId);
    await this.prisma.invoice.delete({ where: { id: invoice.id } });
    return { ok: true };
  }

  private async findInvoice(companyId: number, invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice || invoice.companyId !== companyId) {
      throw new NotFoundException('Invoice not found.');
    }
    return invoice;
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

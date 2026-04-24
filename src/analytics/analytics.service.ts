import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CashflowRow = {
  month: string;
  income: string;
  expense: string;
  net: string;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async cashflow(companyId: number, userId: number): Promise<CashflowRow[]> {
    await this.ensureMember(companyId, userId);

    const incomeRows = await this.prisma.$queryRaw<
      Array<{ month: string; amount: string | null }>
    >`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0) AS amount
      FROM "Income"
      WHERE "companyId" = ${companyId}
      GROUP BY 1
      ORDER BY 1
    `;

    const expenseRows = await this.prisma.$queryRaw<
      Array<{ month: string; amount: string | null }>
    >`
      SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
             COALESCE(SUM(amount), 0) AS amount
      FROM "Expense"
      WHERE "companyId" = ${companyId}
      GROUP BY 1
      ORDER BY 1
    `;

    const map = new Map<string, { income: number; expense: number }>();

    for (const row of incomeRows) {
      map.set(row.month, {
        income: Number.parseFloat(row.amount ?? '0'),
        expense: 0,
      });
    }

    for (const row of expenseRows) {
      const current = map.get(row.month) ?? { income: 0, expense: 0 };
      current.expense = Number.parseFloat(row.amount ?? '0');
      map.set(row.month, current);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        month,
        income: values.income.toFixed(2),
        expense: values.expense.toFixed(2),
        net: (values.income - values.expense).toFixed(2),
      }));
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

import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireRoles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';
import type { Request } from 'express';

type AuthRequest = Request & { user?: { sub: string; email: string } };

const parseId = (value: string, label: string) => {
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id)) {
    throw new BadRequestException(`${label} must be a number.`);
  }
  return id;
};

@UseGuards(JwtAuthGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(RolesGuard)
  @RequireRoles('ADMIN', 'ACCOUNTANT')
  @Get('companies/:companyId/analytics/cashflow')
  async cashflow(@Req() request: AuthRequest, @Param('companyId') companyId: string) {
    const userId = Number.parseInt(request.user?.sub ?? '', 10);
    if (!Number.isFinite(userId)) {
      throw new BadRequestException('Invalid user.');
    }
    return this.analyticsService.cashflow(parseId(companyId, 'CompanyId'), userId);
  }
}

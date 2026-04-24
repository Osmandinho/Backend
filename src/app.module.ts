import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { CompanyController } from './company/company.controller';
import { CompanyService } from './company/company.service';
import { CategoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';
import { IncomeController } from './income/income.controller';
import { IncomeService } from './income/income.service';
import { ExpenseController } from './expense/expense.controller';
import { ExpenseService } from './expense/expense.service';
import { InvoiceController } from './invoice/invoice.controller';
import { InvoiceService } from './invoice/invoice.service';
import { AnalyticsController } from './analytics/analytics.controller';
import { AnalyticsService } from './analytics/analytics.service';
import { MembershipController } from './membership/membership.controller';
import { MembershipService } from './membership/membership.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // .env bude dostupne vsude
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change_me',
    }),
    PrismaModule,
  ],
  controllers: [
    AppController,
    AuthController,
    CompanyController,
    CategoryController,
    IncomeController,
    ExpenseController,
    InvoiceController,
    AnalyticsController,
    MembershipController,
  ],
  providers: [
    AppService,
    AuthService,
    CompanyService,
    CategoryService,
    IncomeService,
    ExpenseService,
    InvoiceService,
    AnalyticsService,
    MembershipService,
  ],
})
export class AppModule {}

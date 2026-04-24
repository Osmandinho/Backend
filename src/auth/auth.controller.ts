import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthPayload = {
  email?: string;
  password?: string;
};

type RefreshPayload = {
  refreshToken?: string;
};

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/register')
  async register(@Body() body: AuthPayload) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email is required.');
    }

    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    return this.authService.register(email, password);
  }

  @Post('auth/login')
  async login(@Body() body: AuthPayload) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';

    if (!email || !password) {
      throw new BadRequestException('Email and password are required.');
    }

    return this.authService.login(email, password);
  }

  @Post('auth/refresh')
  async refresh(@Body() body: RefreshPayload) {
    const refreshToken = body.refreshToken ?? '';
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }
    return this.authService.refresh(refreshToken);
  }

  @Post('auth/logout')
  async logout(@Body() body: RefreshPayload) {
    const refreshToken = body.refreshToken ?? '';
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }
    await this.authService.logout(refreshToken);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  async me(@Req() request: { user?: { sub: string; email: string } }) {
    return {
      id: request.user?.sub ? Number(request.user.sub) : null,
      email: request.user?.email ?? null,
    };
  }
}

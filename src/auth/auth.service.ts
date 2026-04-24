import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type PublicUser = {
  id: number;
  email: string;
};

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type AuthResult = {
  user: PublicUser;
  tokens: AuthTokens;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email is already registered.');
    }

    const passwordHash = this.hashPassword(password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true },
    });

    const tokens = await this.issueTokens(user);
    return { user, tokens };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokens({ id: user.id, email: user.email });
    return { user: { id: user.id, email: user.email }, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        user: { select: { id: true, email: true } },
      },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(record.user);
    return { user: record.user, tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const storedHash = Buffer.from(hashHex, 'hex');
    const computedHash = scryptSync(password, salt, storedHash.length);

    if (computedHash.length !== storedHash.length) {
      return false;
    }

    return timingSafeEqual(computedHash, storedHash);
  }

  private async issueTokens(user: PublicUser): Promise<AuthTokens> {
    const accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
    const signOptions: JwtSignOptions = {
      expiresIn: accessTtl as JwtSignOptions['expiresIn'],
    };

    const accessToken = await this.jwtService.signAsync(
      { sub: String(user.id), email: user.email },
      signOptions,
    );

    const refreshToken = randomBytes(40).toString('hex');
    const expiresAt = this.refreshExpiryDate();

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userId: user.id,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiryDate(): Date {
    const rawDays = process.env.REFRESH_TOKEN_DAYS ?? '30';
    const days = Number.parseInt(rawDays, 10);
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
    return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
  }
}

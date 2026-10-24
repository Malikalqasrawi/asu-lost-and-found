import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EnvironmentVariables } from '../config/env.validation.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  toProfile,
  UserProfile,
  UsersService,
} from '../users/users.service.js';
import { adminSignInEmail } from './auth-emails.js';
import { AdminCodeDto, CredentialsDto } from './dto/auth.dto.js';
import { codeExpiry, EmailCodesService } from './email-codes.service.js';
import { verifyPassword } from './passwords.js';
import { TokenPair, TokensService } from './tokens.service.js';

const CHALLENGE_TTL_SECONDS = 5 * 60;

export interface AdminChallenge {
  /** Proves the password step passed; sent back with the emailed code. */
  challenge: string;
  message: string;
}

export interface AdminSession extends TokenPair {
  user: UserProfile;
}

const wrongPassword = () =>
  new UnauthorizedException('Email or password is incorrect');

/**
 * The admin website signs in with a password and then a code sent by email.
 * Only the tokens it gets at the end can use admin endpoints.
 */
@Injectable()
export class AdminAuthService {
  private readonly challengeSecret: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly codes: EmailCodesService,
    private readonly tokens: TokensService,
    private readonly outbox: OutboxService,
  ) {
    // A challenge is signed with a different key, so it can never pass as an access token.
    this.challengeSecret = `${config.get('JWT_SECRET', { infer: true })}:admin-challenge`;
  }

  /** A wrong password and a student account answer the same, so nobody learns who is an admin. */
  async login(dto: CredentialsDto): Promise<AdminChallenge> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash,
    );
    if (!user?.emailVerifiedAt || !passwordMatches || user.role !== 'ADMIN') {
      throw wrongPassword();
    }
    await this.prisma.$transaction(async (tx) => {
      const code = await this.codes.issue(tx, user.id, 'ADMIN_SIGN_IN');
      if (code) {
        await this.outbox.enqueue(tx, adminSignInEmail(user.email, code), {
          expiresAt: codeExpiry(),
        });
      }
    });
    const challenge = await this.jwt.signAsync(
      { sub: user.id },
      { secret: this.challengeSecret, expiresIn: CHALLENGE_TTL_SECONDS },
    );
    return { challenge, message: 'We emailed you a 6-digit code.' };
  }

  async verify(dto: AdminCodeDto): Promise<AdminSession> {
    const claims = await this.jwt
      .verifyAsync<{ sub: string }>(dto.challenge, {
        secret: this.challengeSecret,
      })
      .catch(() => null);
    const user = claims && (await this.users.findVerifiedById(claims.sub));
    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Sign in again.');
    }
    if (!(await this.codes.consume(user.id, 'ADMIN_SIGN_IN', dto.code))) {
      throw new BadRequestException('The code is wrong or has expired');
    }
    const pair = await this.tokens.issue(user, { adminSession: true });
    return { ...pair, user: toProfile(user) };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, true);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}

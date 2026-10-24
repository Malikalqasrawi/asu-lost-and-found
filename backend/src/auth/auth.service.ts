import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  banHasEnded,
  bannedMessage,
  isBanned,
  liftBan,
} from '../users/bans.js';
import {
  toProfile,
  UserProfile,
  UsersService,
} from '../users/users.service.js';
import {
  passwordResetEmail,
  securitySignInEmail,
  verificationEmail,
} from './auth-emails.js';
import {
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto.js';
import { EmailRule } from './email-domain.js';
import { codeExpiry, EmailCodesService } from './email-codes.service.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { TokenPair, TokensService } from './tokens.service.js';

export interface AuthResponse extends TokenPair {
  user: UserProfile;
}

const invalidCode = () =>
  new BadRequestException('The code is wrong or has expired');

@Injectable()
export class AuthService {
  constructor(
    private readonly emailRule: EmailRule,
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly codes: EmailCodesService,
    private readonly tokens: TokensService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Answers the same way whether or not the email is already taken, so the
   * sign-up form can't be used to find out who has an account.
   */
  async register(dto: RegisterDto): Promise<void> {
    this.emailRule.check(dto.email);
    const passwordHash = await hashPassword(dto.password);

    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { email: dto.email },
        });
        if (existing?.emailVerifiedAt) {
          return;
        }

        const data = { fullName: dto.fullName, passwordHash };
        const user = existing
          ? await tx.user.update({ where: { id: existing.id }, data })
          : await tx.user.create({ data: { ...data, email: dto.email } });

        const code = await this.codes.issue(tx, user.id, 'VERIFY_EMAIL');
        if (code) {
          await this.outbox.enqueue(tx, verificationEmail(user.email, code), {
            expiresAt: codeExpiry(),
          });
        }
      });
    } catch (error) {
      const sameEmailAtOnce =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
      if (!sameEmailAtOnce) {
        throw error;
      }
    }
  }

  async resendVerificationCode(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const code = await this.codes.issue(tx, user.id, 'VERIFY_EMAIL');
      if (code) {
        await this.outbox.enqueue(tx, verificationEmail(user.email, code), {
          expiresAt: codeExpiry(),
        });
      }
    });
  }

  /**
   * Needs the password as well as the code. Otherwise someone could sign up
   * with another student's email and their own password, wait for the real
   * owner to enter the code, and then sign in to the verified account.
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash,
    );
    if (!user || user.emailVerifiedAt || !passwordMatches) {
      throw invalidCode();
    }
    if (!(await this.codes.consume(user.id, 'VERIFY_EMAIL', dto.code))) {
      throw invalidCode();
    }

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return {
      ...(await this.tokens.issue(verified)),
      user: toProfile(verified),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    const passwordMatches = await verifyPassword(
      dto.password,
      user?.passwordHash,
    );
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        message: 'Verify your email first. We sent you a code.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (user.role === 'SECURITY') {
      await this.checkSecurityCode(user, dto.code);
    }
    return this.startSession(user);
  }

  /**
   * The desk sees finders' emails and original photos, so a password alone
   * isn't enough: the first try emails a code, the second brings it back.
   */
  private async checkSecurityCode(user: User, code?: string): Promise<void> {
    if (code) {
      if (!(await this.codes.consume(user.id, 'SECURITY_SIGN_IN', code))) {
        throw invalidCode();
      }
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const issued = await this.codes.issue(tx, user.id, 'SECURITY_SIGN_IN');
      if (issued) {
        await this.outbox.enqueue(tx, securitySignInEmail(user.email, issued), {
          expiresAt: codeExpiry(),
        });
      }
    });
    throw new ForbiddenException({
      message: 'We emailed you a 6-digit code. Enter it to finish signing in.',
      code: 'SIGN_IN_CODE_REQUIRED',
    });
  }

  /**
   * Only after the password or Microsoft vouched for the user, so it never
   * tells a stranger about a ban.
   */
  async startSession(user: User): Promise<AuthResponse> {
    if (isBanned(user)) {
      throw new ForbiddenException({
        message: bannedMessage(user),
        code: 'ACCOUNT_BANNED',
      });
    }
    if (banHasEnded(user)) {
      await this.prisma.$transaction((tx) => liftBan(tx, user.id));
    }
    return { ...(await this.tokens.issue(user)), user: toProfile(user) };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user?.emailVerifiedAt) {
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      const code = await this.codes.issue(tx, user.id, 'RESET_PASSWORD');
      if (code) {
        await this.outbox.enqueue(tx, passwordResetEmail(user.email, code), {
          expiresAt: codeExpiry(),
        });
      }
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.emailVerifiedAt) {
      throw invalidCode();
    }
    if (!(await this.codes.consume(user.id, 'RESET_PASSWORD', dto.code))) {
      throw invalidCode();
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(dto.newPassword),
        // Access tokens carry their issue time in whole seconds.
        tokensValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000),
      },
    });
    await this.tokens.revokeAllForUser(user.id);
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revoke(refreshToken);
  }
}

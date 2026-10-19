import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { MINUTE } from '../common/time.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { microsoftLinkedEmail } from './auth-emails.js';
import { AuthResponse, AuthService } from './auth.service.js';
import { MicrosoftLoginDto } from './dto/auth.dto.js';
import { EmailRule } from './email-domain.js';
import {
  microsoftFailed,
  MicrosoftIdentity,
  MicrosoftTokenVerifier,
} from './microsoft-token.js';

const NONCE_TTL_MS = 10 * MINUTE;
const NO_NAME = 'ASU student';

const hashNonce = (nonce: string) =>
  createHash('sha256').update(nonce).digest('hex');

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

@Injectable()
export class MicrosoftAuthService {
  constructor(
    private readonly verifier: MicrosoftTokenVerifier,
    private readonly emailRule: EmailRule,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly auth: AuthService,
  ) {}

  /** The app puts this in its request to Microsoft, and the ID token carries it back. */
  async start(): Promise<{ nonce: string }> {
    this.checkTurnedOn();
    const nonce = randomBytes(32).toString('base64url');
    const now = Date.now();
    await this.prisma.signInNonce.deleteMany({
      where: { expiresAt: { lte: new Date(now) } },
    });
    await this.prisma.signInNonce.create({
      data: {
        nonceHash: hashNonce(nonce),
        expiresAt: new Date(now + NONCE_TTL_MS),
      },
    });
    return { nonce };
  }

  async signIn(dto: MicrosoftLoginDto): Promise<AuthResponse> {
    this.checkTurnedOn();
    const identity = await this.verifier.verify(dto.idToken);
    // Used up here, so a copied ID token can't sign in a second time.
    const used = await this.prisma.signInNonce.deleteMany({
      where: {
        nonceHash: hashNonce(identity.nonce),
        expiresAt: { gt: new Date() },
      },
    });
    if (used.count === 0) {
      throw microsoftFailed();
    }
    this.emailRule.check(identity.email);

    // Two first sign-ins at once both try to create the account; the retry finds it.
    const user = await this.findOrCreate(identity).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        return this.findOrCreate(identity);
      }
      throw error;
    });
    return this.auth.startSession(user);
  }

  private checkTurnedOn(): void {
    if (!this.verifier.enabled) {
      throw new NotFoundException('Microsoft sign-in is not turned on.');
    }
  }

  /** The account linked to this Microsoft account, else the one with its email, else a new one. */
  private findOrCreate(identity: MicrosoftIdentity): Promise<User> {
    const { microsoftId, email } = identity;
    return this.prisma.$transaction(async (tx) => {
      const linked = await tx.user.findUnique({ where: { microsoftId } });
      if (linked) {
        return linked;
      }
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        return this.link(tx, existing, identity);
      }
      return tx.user.create({
        data: {
          email,
          fullName: identity.name || NO_NAME,
          microsoftId,
          emailVerifiedAt: new Date(),
        },
      });
    });
  }

  /**
   * Microsoft has proved the email belongs to this student. A sign-up that never
   * confirmed it may be someone else's, so it loses the password and name it was
   * made with; a confirmed account keeps both and its owner is told.
   */
  private async link(
    tx: Prisma.TransactionClient,
    existing: User,
    { microsoftId, name }: MicrosoftIdentity,
  ): Promise<User> {
    if (existing.microsoftId) {
      throw new ConflictException(
        'This email belongs to an account linked to another Microsoft account.',
      );
    }
    if (!existing.emailVerifiedAt) {
      return tx.user.update({
        where: { id: existing.id },
        data: {
          microsoftId,
          emailVerifiedAt: new Date(),
          passwordHash: null,
          fullName: name || NO_NAME,
        },
      });
    }
    await this.outbox.enqueue(tx, microsoftLinkedEmail(existing.email));
    return tx.user.update({
      where: { id: existing.id },
      data: { microsoftId },
    });
  }
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmailCodesService } from '../auth/email-codes.service.js';
import { EmailRule } from '../auth/email-domain.js';
import { verifyPassword } from '../auth/passwords.js';
import { TokensService } from '../auth/tokens.service.js';
import { ClaimLimit } from '../claims/claim-limit.js';
import { ClaimsService } from '../claims/claims.service.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { OutboxService } from '../mail/outbox.service.js';
import { lockPost, lockUser } from '../prisma/locks.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isBanned } from '../users/bans.js';
import { toProfile, type UserProfile } from '../users/users.service.js';
import {
  accountDeletedEmail,
  confirmationCodeEmail,
  emailChangedEmail,
  newEmailCodeEmail,
} from './account-emails.js';
import { ChangeEmailDto, ConfirmIdentityDto } from './dto/account.dto.js';

export interface EmailChanged {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

/** Access tokens carry their issue time in whole seconds. */
const thisSecond = () => new Date(Math.floor(Date.now() / 1000) * 1000);

const codeNotRight = () =>
  new BadRequestException('The code is wrong or has expired');

const wrongProof = () =>
  new ForbiddenException('Your password or code is not right.');

/** Changing the email and deleting the account, both after proving it's the student. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codes: EmailCodesService,
    private readonly emailRule: EmailRule,
    private readonly tokens: TokensService,
    private readonly outbox: OutboxService,
    private readonly claims: ClaimsService,
    private readonly claimLimit: ClaimLimit,
  ) {}

  /** For accounts without a password: a code to their email stands in for it. */
  async sendConfirmationCode(userId: string): Promise<void> {
    const user = await this.signedIn(userId);
    await this.prisma.$transaction(async (tx) => {
      const code = await this.codes.issue(tx, user.id, 'CONFIRM_ACCOUNT');
      if (code) {
        await this.outbox.enqueue(tx, confirmationCodeEmail(user.email, code));
      }
    });
  }

  /**
   * Answers the same whether or not the new address already has an account, so
   * it can't be used to find out who uses the app. Only a free address gets the code.
   */
  async startEmailChange(userId: string, dto: ChangeEmailDto): Promise<void> {
    const user = await this.signedIn(userId);
    await this.confirmIdentity(user, dto);
    this.emailRule.check(dto.newEmail);
    if (dto.newEmail === user.email) {
      throw new BadRequestException('That is already your email.');
    }
    await this.prisma.$transaction(async (tx) => {
      // A second request at the same moment waits here, then finds this code and gets 429.
      await lockUser(tx, user.id);
      // Without a new code, the last one could confirm an address it was never sent to.
      const code = await this.codes.issue(tx, user.id, 'CHANGE_EMAIL');
      if (!code) {
        throw new HttpException(
          'Wait a minute before asking for another code. You can ask for 5 a day.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await tx.user.update({
        where: { id: user.id },
        data: { pendingEmail: dto.newEmail },
      });
      const taken = await tx.user.count({
        where: { email: dto.newEmail, emailVerifiedAt: { not: null } },
      });
      if (!taken) {
        await this.outbox.enqueue(tx, newEmailCodeEmail(dto.newEmail, code));
      }
    });
  }

  /**
   * The code proves the new address is theirs; every other device is signed out.
   * The Microsoft link belonged to the old address, so it goes too: the next
   * Microsoft sign-in with the new address links it again.
   */
  async confirmEmailChange(
    userId: string,
    code: string,
  ): Promise<EmailChanged> {
    const user = await this.signedIn(userId);
    const newEmail = user.pendingEmail;
    if (
      !newEmail ||
      !(await this.codes.consume(user.id, 'CHANGE_EMAIL', code))
    ) {
      throw codeNotRight();
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // A sign-up that never confirmed this address loses it to the student who just did.
        await tx.user.deleteMany({
          where: { email: newEmail, emailVerifiedAt: null, deletedAt: null },
        });
        const moved = await tx.user.updateMany({
          where: { id: user.id, deletedAt: null, pendingEmail: newEmail },
          data: {
            email: newEmail,
            pendingEmail: null,
            microsoftId: null,
            tokensValidAfter: thisSecond(),
          },
        });
        if (moved.count === 0) {
          throw codeNotRight();
        }
        await tx.refreshToken.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.outbox.enqueue(tx, emailChangedEmail(user.email, newEmail));
        return tx.user.findUniqueOrThrow({ where: { id: user.id } });
      });
      return {
        ...(await this.tokens.issue(updated)),
        user: toProfile(updated),
      };
    } catch (error) {
      // P2003: the unconfirmed sign-up is still referenced (an admin banned it).
      const taken =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2003');
      throw taken
        ? new ConflictException('That email already has an account.')
        : error;
    }
  }

  /**
   * Everything is checked again inside the transaction, with the student's row
   * and posts locked, so a claim accepted at the same moment can't leave a
   * handover with a deleted account on one side.
   */
  async deleteAccount(userId: string, dto: ConfirmIdentityDto): Promise<void> {
    await this.confirmIdentity(await this.signedIn(userId), dto);
    await this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      checkMayLeave(user);
      const openPosts = await tx.post.findMany({
        where: { authorId: user.id, status: 'OPEN' },
        select: { id: true, title: true },
      });
      for (const post of openPosts) {
        await lockPost(tx, post.id);
      }
      await tx.claim.updateMany({
        where: { claimantId: user.id, status: 'PENDING' },
        data: { status: 'WITHDRAWN', decidedAt: new Date() },
      });
      await checkNothingInHand(tx, user.id);
      await this.closePosts(tx, openPosts);
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.emailCode.deleteMany({ where: { userId: user.id } });
      await this.outbox.enqueue(tx, accountDeletedEmail(user.email));
      await tx.user.update({
        where: { id: user.id },
        data: {
          ...anonymous(user),
          erasedEmailHash: this.claimLimit.emailHash(user.email),
        },
      });
    });
  }

  private async signedIn(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException();
    }
    return user;
  }

  private async confirmIdentity(
    user: User,
    { password, code }: ConfirmIdentityDto,
  ): Promise<void> {
    if (password) {
      if (!(await verifyPassword(password, user.passwordHash))) {
        throw wrongProof();
      }
      return;
    }
    if (!code) {
      throw new BadRequestException('Enter your password or the emailed code.');
    }
    if (!(await this.codes.consume(user.id, 'CONFIRM_ACCOUNT', code))) {
      throw wrongProof();
    }
  }

  private async closePosts(
    tx: Prisma.TransactionClient,
    posts: { id: string; title: string }[],
  ): Promise<void> {
    for (const post of posts) {
      await tx.post.update({
        where: { id: post.id },
        data: { status: 'CLOSED' },
      });
      await this.claims.closeForPost(tx, post.id, post.title);
    }
  }
}

/** A ban can't be escaped by leaving, and an admin has to step down first. */
function checkMayLeave(user: User): void {
  if (isBanned(user)) {
    throw new ForbiddenException(
      'A banned account cannot be deleted until the ban ends.',
    );
  }
  if (user.role === 'ADMIN') {
    throw new ForbiddenException(
      'Admin accounts cannot be deleted. Ask another admin to remove the admin role first.',
    );
  }
}

/** Nobody may be left waiting for an item. */
async function checkNothingInHand(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const busy = await tx.handover.count({
    where: {
      returnedAt: null,
      OR: [{ finderId: userId }, { ownerId: userId }],
    },
  });
  const atDesk = await tx.deskItem.count({
    where: {
      post: { authorId: userId, status: { in: ['OPEN', 'CLAIMED'] } },
    },
  });
  if (busy || atDesk) {
    throw new ConflictException(
      'Finish your handovers first: an item is still waiting to change hands or is with the security office.',
    );
  }
}

/** Keeps the row for history (claims, reports, chats) but nothing that names them. */
function anonymous(user: User): Prisma.UserUpdateInput {
  return {
    email: `deleted-${user.id}@deleted.invalid`,
    fullName: 'Deleted student',
    passwordHash: null,
    emailVerifiedAt: null,
    pendingEmail: null,
    microsoftId: null,
    matchEmailedAt: null,
    bannedAt: null,
    bannedUntil: null,
    banReason: null,
    deletedAt: new Date(),
    tokensValidAfter: thisSecond(),
  };
}

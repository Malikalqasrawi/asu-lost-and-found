import { ConflictException, NotFoundException } from '@nestjs/common';
import type { User } from '../generated/prisma/client.js';
import type { OutboxService } from '../mail/outbox.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from './auth.service.js';
import type { EmailRule } from './email-domain.js';
import { MicrosoftAuthService } from './microsoft-auth.service.js';
import type {
  MicrosoftIdentity,
  MicrosoftTokenVerifier,
} from './microsoft-token.js';

describe('MicrosoftAuthService', () => {
  it('answers 404 and checks no token while Microsoft sign-in is off', async () => {
    const verify = vi.fn();
    const service = new MicrosoftAuthService(
      { enabled: false, verify } as unknown as MicrosoftTokenVerifier,
      {} as EmailRule,
      {} as PrismaService,
      {} as OutboxService,
      {} as AuthService,
    );

    await expect(service.start()).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.signIn({ idToken: 'a.b.c' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(verify).not.toHaveBeenCalled();
  });

  describe('when a sign-in at the same moment links the account first', () => {
    const identity: MicrosoftIdentity = {
      microsoftId: 'tenant:object-1',
      email: '123456789@students.asu.edu.jo',
      name: 'Lina Haddad',
      nonce: 'nonce',
    };

    // The lookup by Microsoft id misses the account, which the other sign-in
    // commits just before the lookup by email finds it.
    function signInRacing(found: Partial<User>) {
      const tx = {
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(found),
          update: vi.fn(),
          create: vi.fn(),
        },
      };
      const startSession = vi.fn((user: User) =>
        Promise.resolve({ user } as never),
      );
      const service = new MicrosoftAuthService(
        {
          enabled: true,
          verify: () => Promise.resolve(identity),
        } as unknown as MicrosoftTokenVerifier,
        { check: () => undefined } as unknown as EmailRule,
        {
          signInNonce: { deleteMany: () => Promise.resolve({ count: 1 }) },
          $transaction: (work: (client: typeof tx) => Promise<User>) =>
            work(tx),
        } as unknown as PrismaService,
        {} as OutboxService,
        { startSession } as unknown as AuthService,
      );
      return { result: service.signIn({ idToken: 'a.b.c' }), tx, startSession };
    }

    it('signs in to the account linked to the same Microsoft account', async () => {
      const account = { id: 'user-1', microsoftId: identity.microsoftId };

      const { result, tx, startSession } = signInRacing(account);

      await result;
      expect(startSession).toHaveBeenCalledWith(account);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('still refuses an account linked to a different Microsoft account', async () => {
      const { result } = signInRacing({
        id: 'user-1',
        microsoftId: 'tenant:someone-else',
      });

      await expect(result).rejects.toBeInstanceOf(ConflictException);
    });
  });
});

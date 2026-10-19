import { NotFoundException } from '@nestjs/common';
import type { OutboxService } from '../mail/outbox.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthService } from './auth.service.js';
import type { EmailRule } from './email-domain.js';
import { MicrosoftAuthService } from './microsoft-auth.service.js';
import type { MicrosoftTokenVerifier } from './microsoft-token.js';

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
});

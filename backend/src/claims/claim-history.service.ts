import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ClaimantHistory {
  userId: string;
  fullName: string;
  email: string;
  claims: number;
  accepted: number;
  rejected: number;
}

const SHOWN = 50;

/** Lets an admin spot students who claim everything: most rejected claims first. */
@Injectable()
export class ClaimHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async claimants(): Promise<ClaimantHistory[]> {
    const groups = await this.prisma.claim.groupBy({
      by: ['claimantId', 'status'],
      _count: { _all: true },
    });

    const totals = new Map<
      string,
      { claims: number; accepted: number; rejected: number }
    >();
    for (const group of groups) {
      const total = totals.get(group.claimantId) ?? {
        claims: 0,
        accepted: 0,
        rejected: 0,
      };
      total.claims += group._count._all;
      if (group.status === 'ACCEPTED') total.accepted += group._count._all;
      if (group.status === 'REJECTED') total.rejected += group._count._all;
      totals.set(group.claimantId, total);
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...totals.keys()] } },
      select: { id: true, fullName: true, email: true },
    });
    return users
      .map((user) => ({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        ...(totals.get(user.id) ?? { claims: 0, accepted: 0, rejected: 0 }),
      }))
      .sort((a, b) => b.rejected - a.rejected || b.claims - a.claims)
      .slice(0, SHOWN);
  }
}

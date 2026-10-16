import { Injectable, NotFoundException } from '@nestjs/common';
import type { Role, User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: Date;
}

export function toProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
  }

  findVerifiedById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, emailVerifiedAt: { not: null } },
    });
  }

  async setRole(email: string, role: Role): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new NotFoundException(`No account uses ${normalizeEmail(email)}`);
    }
    return this.prisma.user.update({ where: { id: user.id }, data: { role } });
  }
}

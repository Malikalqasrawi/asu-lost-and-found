import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { validateEnv } from '../config/env.validation.js';
import { Role } from '../generated/prisma/client.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { UsersModule } from '../users/users.module.js';
import { UsersService } from '../users/users.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    UsersModule,
  ],
})
class CliModule {}

const roles = Object.values(Role);

async function main(): Promise<void> {
  const [email, role] = process.argv.slice(2);
  if (!email || !roles.includes(role as Role)) {
    console.error(
      `Usage: node dist/cli/set-role.js <email> <${roles.join('|')}>`,
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule, {
    logger: ['error'],
  });
  try {
    const user = await app.get(UsersService).setRole(email, role as Role);
    console.log(`${user.email} is now ${user.role}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();

import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

// Migrations run as the database owner. The app itself connects with DATABASE_URL,
// a login that can only read and write rows. `prisma generate` needs no database,
// so a missing URL only fails the commands that connect.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.MIGRATION_DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});

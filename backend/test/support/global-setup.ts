import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

const initScript = join(
  import.meta.dirname,
  '../../../docker/postgres/create-roles.sh',
);

let container: StartedPostgreSqlContainer | undefined;

function urlFor(
  database: StartedPostgreSqlContainer,
  username: string,
  password: string,
): string {
  const url = new URL(database.getConnectionUri());
  url.username = username;
  url.password = password;
  return url.toString();
}

function useColimaIfPresent(): void {
  const socket = join(homedir(), '.colima', 'default', 'docker.sock');
  if (!process.env.DOCKER_HOST && existsSync(socket)) {
    process.env.DOCKER_HOST = `unix://${socket}`;
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock';
  }
}

export async function setup(project: TestProject): Promise<void> {
  useColimaIfPresent();

  const ownerPassword = randomUUID();
  const appPassword = randomUUID();

  container = await new PostgreSqlContainer('postgres:17-alpine')
    .withDatabase('lostfound')
    .withUsername('postgres')
    .withPassword(randomUUID())
    .withEnvironment({
      DB_PASSWORD: ownerPassword,
      DB_APP_PASSWORD: appPassword,
    })
    .withCopyFilesToContainer([
      {
        source: initScript,
        target: '/docker-entrypoint-initdb.d/create-roles.sh',
        mode: 0o755,
      },
    ])
    .start();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: {
      ...process.env,
      MIGRATION_DATABASE_URL: urlFor(container, 'lostfound', ownerPassword),
    },
    stdio: 'pipe',
  });

  project.provide(
    'databaseUrl',
    urlFor(container, 'lostfound_app', appPassword),
  );
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

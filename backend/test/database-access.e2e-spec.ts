import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, TestContext } from './support/app.js';

describe('database login used by the app', () => {
  let ctx: TestContext;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('connects as the limited app role', async () => {
    const [row] = await prisma.$queryRaw<
      { current_user: string }[]
    >`SELECT current_user`;

    expect(row.current_user).toBe('lostfound_app');
  });

  it('cannot create tables', async () => {
    await expect(
      prisma.$executeRawUnsafe('CREATE TABLE intruder (id int)'),
    ).rejects.toThrow(/permission denied/);
  });

  it('cannot drop the migrations history', async () => {
    await expect(
      prisma.$executeRawUnsafe('DROP TABLE _prisma_migrations'),
    ).rejects.toThrow(/must be owner/);
  });

  it('is not a superuser, and neither is the migrations owner', async () => {
    const roles = await prisma.$queryRaw<
      { rolname: string; rolsuper: boolean }[]
    >`
      SELECT rolname, rolsuper FROM pg_roles
      WHERE rolname IN ('lostfound', 'lostfound_app')
      ORDER BY rolname`;

    expect(roles).toEqual([
      { rolname: 'lostfound', rolsuper: false },
      { rolname: 'lostfound_app', rolsuper: false },
    ]);
  });

  it('runs on a database owned by the migrations owner', async () => {
    const [row] = await prisma.$queryRaw<{ owner: string }[]>`
      SELECT pg_get_userbyid(datdba) AS owner FROM pg_database
      WHERE datname = current_database()`;

    expect(row.owner).toBe('lostfound');
  });
});

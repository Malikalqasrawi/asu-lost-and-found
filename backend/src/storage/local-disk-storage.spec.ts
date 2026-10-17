import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { LocalDiskStorage } from './local-disk-storage.js';

async function storageInTempFolder(): Promise<{
  storage: LocalDiskStorage;
  root: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'storage-test-'));
  const config = { get: () => root } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
  return { storage: new LocalDiskStorage(config), root };
}

describe('LocalDiskStorage', () => {
  it('saves, reads and removes a file', async () => {
    const { storage } = await storageInTempFolder();
    const key = `${randomUUID()}.jpg`;

    await storage.save(key, Buffer.from('photo'));
    expect((await storage.read(key)).toString()).toBe('photo');

    await storage.remove(key);
    await expect(storage.read(key)).rejects.toThrow();
  });

  it('spreads files over subfolders named after the key', async () => {
    const { storage, root } = await storageInTempFolder();
    const key = `${randomUUID()}.jpg`;

    await storage.save(key, Buffer.from('photo'));

    expect(await readdir(join(root, key.slice(0, 2)))).toEqual([key]);
  });

  it('never overwrites an existing file', async () => {
    const { storage } = await storageInTempFolder();
    const key = `${randomUUID()}.jpg`;
    await storage.save(key, Buffer.from('first'));

    await expect(storage.save(key, Buffer.from('second'))).rejects.toThrow();
    expect((await storage.read(key)).toString()).toBe('first');
  });

  it.each([
    '../../etc/passwd',
    '/etc/passwd',
    'photo.jpg',
    `${randomUUID()}.svg`,
    '',
  ])('refuses the key %j', async (key) => {
    const { storage } = await storageInTempFolder();

    await expect(storage.read(key)).rejects.toThrow('Invalid storage key');
    await expect(storage.save(key, Buffer.from('x'))).rejects.toThrow(
      'Invalid storage key',
    );
  });
});

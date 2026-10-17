import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { EnvironmentVariables } from '../config/env.validation.js';
import { FileStorage } from './file-storage.js';

// Keys are made by the server (a UUID and an extension), never taken from a
// request, but they are checked anyway so a bad key can't leave the folder.
const KEY_PATTERN = /^[0-9a-f-]{36}\.jpg$/;

@Injectable()
export class LocalDiskStorage extends FileStorage {
  private readonly root: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.root = resolve(config.get('UPLOAD_DIR', { infer: true }));
  }

  async save(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: 'wx', mode: 0o640 });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key)) {
      throw new Error('Invalid storage key');
    }
    return join(this.root, key.slice(0, 2), key);
  }
}

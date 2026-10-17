import { Global, Module } from '@nestjs/common';
import { FileStorage } from './file-storage.js';
import { LocalDiskStorage } from './local-disk-storage.js';

@Global()
@Module({
  providers: [{ provide: FileStorage, useClass: LocalDiskStorage }],
  exports: [FileStorage],
})
export class StorageModule {}

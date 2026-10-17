export abstract class FileStorage {
  abstract save(key: string, data: Buffer): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
  abstract remove(key: string): Promise<void>;
}

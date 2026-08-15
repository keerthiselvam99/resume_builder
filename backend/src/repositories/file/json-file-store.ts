import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MemoryDbData } from '../memory/memory-store';

/**
 * Dev-only persistence: serializes the in-memory store to a JSON file so the
 * "restart both services and confirm data survives" acceptance can be run
 * without an Oracle instance. NOT a production data store; the Oracle adapters
 * are the production path.
 */
export class JsonFileStore {
  constructor(private readonly filePath: string) {}

  load(): MemoryDbData | null {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw) as MemoryDbData;
    } catch {
      return null;
    }
  }

  save(data: MemoryDbData): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data), 'utf8');
    renameSync(tmpPath, this.filePath);
  }
}

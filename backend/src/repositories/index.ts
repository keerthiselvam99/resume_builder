import { config } from '../config/config';
import { createFileRepositories } from './file';
import { createMemoryRepositories, RepositorySet } from './memory';
import { createOracleRepositories } from './oracle';

let current: RepositorySet | null = null;

/**
 * Builds (once) and returns the repository set selected by DATA_STORE.
 * Lazy so tests can call resetDataStore() between cases for isolation.
 */
export function getRepositories(): RepositorySet {
  if (!current) {
    switch (config.dataStore) {
      case 'oracle':
        current = createOracleRepositories();
        break;
      case 'file':
        current = createFileRepositories(config.fileStorePath);
        break;
      default:
        current = createMemoryRepositories();
        break;
    }
  }
  return current;
}

/** Test hook: drop the current store so the next access builds a fresh one. */
export function resetDataStore(): void {
  current = null;
}

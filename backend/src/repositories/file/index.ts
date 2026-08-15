import { JsonFileStore } from './json-file-store';
import { MemoryStore, createMemoryRepositories } from '../memory';

export function createFileRepositories(filePath: string) {
  const fileStore = new JsonFileStore(filePath);
  const store = new MemoryStore();
  const existing = fileStore.load();
  if (existing) {
    store.restore(existing);
  }
  store.onMutate = () => fileStore.save(store.snapshot());
  return createMemoryRepositories(store);
}

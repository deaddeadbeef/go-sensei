import { beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function defineStorage(name: 'localStorage' | 'sessionStorage') {
  if (typeof globalThis[name] !== 'undefined') return;

  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    configurable: true,
  });
}

defineStorage('localStorage');
defineStorage('sessionStorage');

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  const { useProgressStore } = await import('@/stores/progress-store');
  useProgressStore.getState().resetAll();
});

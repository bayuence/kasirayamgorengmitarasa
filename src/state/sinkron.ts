import { signal } from '@preact/signals';

export type StatusSinkron = 'tersinkron' | 'menunggu' | 'offline';

export const statusSinkronSignal = signal<StatusSinkron>(
  typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'tersinkron',
);
export const pendingOutboxCountSignal = signal<number>(0);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    statusSinkronSignal.value =
      pendingOutboxCountSignal.value > 0 ? 'menunggu' : 'tersinkron';
  });

  window.addEventListener('offline', () => {
    statusSinkronSignal.value = 'offline';
  });
}


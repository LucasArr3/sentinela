// Definição do tipo para WakeLock
export type WakeLockSentinela = {
  release: () => void;
  addEventListener: (event: string, callback: () => void) => void;
};

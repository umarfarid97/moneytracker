// Shared in-memory stand-ins for the native lock modules, used through jest.mock factories in the security tests.
export const mem = { settings: null as string | null, pin: null as string | null, attempts: null as string | null, failRead: false, failWrite: false };

export const lockStorageMock = () => ({
  loadAttemptRecord: async () => { if (mem.failRead) throw new Error('storage'); return mem.attempts; },
  saveAttemptRecord: async (v: string) => { if (mem.failWrite) throw new Error('storage'); mem.attempts = v; },
  loadLockSettings: () => mem.settings,
  saveLockSettings: (v: string) => {
    mem.settings = v;
  },
  loadPinRecord: async () => mem.pin,
  savePinRecord: async (v: string) => {
    mem.pin = v;
  },
  clearPinRecord: async () => {
    mem.pin = null;
  },
});

export const cryptoMock = () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_a: string, s: string) => nodeCrypto.createHash('sha256').update(s).digest('hex'),
    randomUUID: () => nodeCrypto.randomUUID(),
  };
};

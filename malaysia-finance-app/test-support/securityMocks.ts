// Shared in-memory stand-ins for the native lock modules, used through jest.mock factories in the security tests.
export const mem = { settings: null as string | null, pin: null as string | null };

export const lockStorageMock = () => ({
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

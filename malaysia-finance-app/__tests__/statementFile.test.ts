import { pickStatementFile as pickNative } from '@/statementFile';
import { pickStatementFile as pickWeb } from '@/statementFile.web';
import { File } from 'expo-file-system';
jest.mock('expo-file-system', () => ({ File: { pickFileAsync: jest.fn() } }));

const file = (name: string, size: number) => ({ name, size, arrayBuffer: jest.fn(async () => new ArrayBuffer(0)), text: jest.fn(async () => 'date,amount') });

describe('statement selection bounds', () => {
  test.each(['statement.pdf', 'statement.csv'])('native rejects oversized %s before reading', async (name) => {
    const selected = file(name, 10485761);
    (File.pickFileAsync as jest.Mock).mockResolvedValue({ canceled: false, result: selected });
    await expect(pickNative()).rejects.toThrow(/10 MiB|large|limit/i);
    expect(selected.arrayBuffer).not.toHaveBeenCalled();
    expect(selected.text).not.toHaveBeenCalled();
  });
  test.each(['statement.pdf', 'statement.csv'])('web rejects oversized %s before reading', async (name) => {
    const selected = file(name, 10485761);
    const input = { files: [selected], onchange: undefined as undefined | (() => void), addEventListener: jest.fn(), click: () => input.onchange?.() };
    const previous = globalThis.document;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => input } });
    try {
      await expect(pickWeb()).rejects.toThrow(/10 MiB|large|limit/i);
      expect(selected.arrayBuffer).not.toHaveBeenCalled();
      expect(selected.text).not.toHaveBeenCalled();
    } finally { Object.defineProperty(globalThis, 'document', { configurable: true, value: previous }); }
  });
  test('native retains ordinary CSV selection', async () => {
    (File.pickFileAsync as jest.Mock).mockResolvedValue({ canceled: false, result: file('statement.csv', 11) });
    await expect(pickNative()).resolves.toEqual({ name: 'statement.csv', kind: 'csv', text: 'date,amount' });
  });
});

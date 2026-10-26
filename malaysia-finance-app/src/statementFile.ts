import { File } from 'expo-file-system';

/** A statement the user chose: CSV text, or the bytes of a PDF. */
export type StatementFile = { name: string; kind: 'csv'; text: string } | { name: string; kind: 'pdf'; bytes: Uint8Array };

/** Lets the user choose a CSV or PDF statement. Resolves null if they cancelled. */
export async function pickStatementFile(): Promise<StatementFile | null> {
  // Some file managers label .csv files as plain binary, so any file can be picked; the name decides how it is read.
  const picked = await File.pickFileAsync({ mimeTypes: ['text/csv', 'text/comma-separated-values', 'application/pdf', '*/*'] });
  if (picked.canceled) return null;
  const file = picked.result;
  const name = file.name;
  if (/\.pdf$/i.test(name)) return { name, kind: 'pdf', bytes: new Uint8Array(await file.arrayBuffer()) };
  return { name, kind: 'csv', text: await file.text() };
}

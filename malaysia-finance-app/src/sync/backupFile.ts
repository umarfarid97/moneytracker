import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the backup to a temporary file and opens the share sheet (save to Files, Drive, WhatsApp...). */
export async function saveBackupFile(name: string, text: string, dialogTitle: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle });
}

/** Lets the user choose a backup file. Resolves its text, or null if they cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  // Some file managers label .json files as plain binary, so any file can be picked; parseBackup checks it.
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', '*/*'] });
  if (picked.canceled) return null;
  return picked.result.text();
}

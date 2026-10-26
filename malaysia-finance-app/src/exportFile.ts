import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

/** Writes `text` to a temporary file and opens the share sheet (save to Files, Drive, email...). */
export async function shareTextFile(name: string, text: string, mimeType: string, dialogTitle: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle });
}

/** Renders HTML to a PDF and opens the share sheet. */
export async function sharePdf(html: string, dialogTitle: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
}

import type { StatementFile } from './statementFile';
import { assertStatementSize } from './statementLimits';

export type { StatementFile };

/** Browser: opens the file chooser for a CSV or PDF statement. */
export function pickStatementFile(): Promise<StatementFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.pdf,text/csv,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        assertStatementSize(file.size);
        if (/\.pdf$/i.test(file.name)) resolve({ name: file.name, kind: 'pdf', bytes: new Uint8Array(await file.arrayBuffer()) });
        else resolve({ name: file.name, kind: 'csv', text: await file.text() });
      } catch (error) {
        reject(error);
      }
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

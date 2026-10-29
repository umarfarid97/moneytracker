/** Shared encoded-file limit for PDF and CSV imports. */
export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;
export function assertStatementSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_STATEMENT_BYTES) {
    throw new Error('Statement file is too large or its size is unavailable. Choose a file up to 10 MiB.');
  }
}

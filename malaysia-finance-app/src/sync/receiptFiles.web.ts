/** The web build keeps no receipt photo files (expo-file-system has no storage there), so there is nothing to back up or sync. */
export const RECEIPT_FILES = false;
export const isStoredReceipt = (_stored: string | null): _stored is string => false;
export const receiptExists = (_stored: string) => false;
export const readReceiptBase64 = async (_stored: string): Promise<string | null> => null;
export const writeReceiptBase64 = async (_stored: string, _base64: string): Promise<void> => {};
export const uploadReceipt = async (_token: string, _stored: string, _name: string): Promise<void> => {};
export const downloadReceipt = async (_token: string, _id: string, _stored: string): Promise<void> => {};

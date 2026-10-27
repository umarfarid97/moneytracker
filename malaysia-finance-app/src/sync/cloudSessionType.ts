/** What a signed-in device keeps. `dataKey` (base64) is null until the passphrase has been entered. */
export type CloudSession = { token: string; email: string; deviceId: string; dataKey: string | null };

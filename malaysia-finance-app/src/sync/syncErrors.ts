/** The synced copy was written by a newer app version; syncing could drop data this version doesn't know. */
export class SyncTooNewError extends Error {
  constructor() {
    super('Synced data is from a newer version of Duit');
  }
}

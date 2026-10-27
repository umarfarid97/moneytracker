/** The synced copy was written by a newer app version; syncing could drop data this version doesn't know. */
export class SyncTooNewError extends Error {
  constructor() {
    super('Synced data is from a newer version of Duit');
  }
}

/** Demo data is loaded (More > Demo data); syncing waits until it is cleared so it can never pass as real data. */
export class DemoLoadedError extends Error {
  constructor() {
    super('Demo data is loaded');
  }
}

/** Browsers have no Alert with buttons, so the web asks with the built-in confirm dialog. */
export function confirmDelete(title: string, message: string): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

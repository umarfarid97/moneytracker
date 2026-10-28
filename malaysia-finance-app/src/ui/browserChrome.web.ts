/**
 * Keeps the page behind the app in step with the active theme. public/index.html starts light, so without this a dark
 * theme shows a white band in Safari's status bar, the overscroll bounce and the home-indicator strip.
 */
export function syncBrowserChrome(ground: string, scheme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.backgroundColor = ground;
  root.style.colorScheme = scheme;
  document.body.style.backgroundColor = ground;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', ground);
}

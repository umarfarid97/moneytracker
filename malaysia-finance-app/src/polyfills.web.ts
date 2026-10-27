import { installCompat, installStartupFallback } from './webCompat';

installCompat(globalThis);
installStartupFallback(window, document);

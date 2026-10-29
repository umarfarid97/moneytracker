import type { ReactNode } from 'react';

/** Native navigation already owns these transitions. */
export function ScreenEntry({ children }: { children: ReactNode }) { return <>{children}</>; }

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayKL } from '@/domain/dates';

/** Today's date in Kuala Lumpur, refreshed when the clock passes midnight or the app returns to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKL());
  useEffect(() => {
    const refresh = () => setToday(todayKL());
    const timer = setInterval(refresh, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return today;
}

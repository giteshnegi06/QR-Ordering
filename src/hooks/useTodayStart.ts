import { useEffect, useState } from 'react';

/** Midnight at the start of the day `d` falls in, as a timestamp. */
export const startOfDay = (d: Date = new Date()): number => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.getTime();
};

/**
 * Timestamp of midnight today, kept live.
 *
 * An admin or kitchen screen stays open across a whole service, so the day
 * boundary can't be read once at mount — anything derived from this value
 * (today's orders) has to empty itself the moment the clock passes midnight,
 * with nobody there to hit refresh.
 */
export const useTodayStart = (): number => {
  const [todayStart, setTodayStart] = useState<number>(startOfDay);

  useEffect(() => {
    // Re-read the clock rather than trusting the timer: a backgrounded tab
    // gets throttled, a sleeping laptop skips the timeout entirely, and
    // "midnight + 24h" is the wrong instant on the two DST changeover days.
    const sync = () => {
      const current = startOfDay();
      setTodayStart((prev) => (prev === current ? prev : current));
    };

    const nextMidnight = new Date(todayStart);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const timer = window.setTimeout(sync, Math.max(1000, nextMidnight.getTime() - Date.now()));
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [todayStart]);

  return todayStart;
};

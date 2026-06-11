'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@ya-ye/ui';

const DURATION = 25 * 60;

interface SessionTimerProps {
  sessionId: string;
  onExpire: () => void;
}

export function SessionTimer({ sessionId, onExpire }: SessionTimerProps) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(DURATION);
  const expiredRef = useRef(false);
  // Зберігаємо id таймера redirect, щоб скасувати при unmount
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire();
            // Канонічний промт 4.9: «UI зараз закриє чат». Даємо 8с прочитати
            // closing-баббли, потім ведемо на graduation-екран /exit.
            exitTimerRef.current = setTimeout(() => {
              router.push(`/${sessionId}/exit`);
            }, 8000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onExpire, router, sessionId]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const isLow = remaining <= 60;

  return (
    <span
      className={cn('font-mono text-[10px] tabular-nums', isLow ? 'text-crisis' : 'text-inkSoft')}
      aria-label={`залишилось ${Math.floor(remaining / 60)} хвилин ${remaining % 60} секунд`}
      aria-live={isLow ? 'assertive' : 'off'}
    >
      {mm}:{ss}
    </span>
  );
}

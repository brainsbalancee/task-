import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useI18n } from '../i18n/LanguageProvider';

/**
 * Counts up to `value` over ~900ms, then formats it for the active locale
 * (Persian digits in Persian). Respects `prefers-reduced-motion`.
 */
export function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const { n } = useI18n();
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduceMotion || value === 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic: fast start, gentle settle.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  return <>{n(display)}</>;
}

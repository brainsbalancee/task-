import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Stagger offset in seconds, for revealing a row of cards in sequence. */
  delay?: number;
  y?: number;
  className?: string;
}

/**
 * Reveals its children once they scroll into view.
 *
 * Uses the `useInView` hook rather than `whileInView`: under React StrictMode
 * the double mount can consume a `once: true` viewport trigger before the
 * element is observed, leaving the content stuck at `opacity: 0`. Driving the
 * animation from an explicit hook keeps the state in React, so the remount
 * re-evaluates it correctly.
 */
export function Reveal({ children, delay = 0, y = 24, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: '0px 0px -60px 0px' });

  return (
    <motion.div
      ref={ref}
      initial={reduceMotion ? false : { opacity: 0, y }}
      animate={inView || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

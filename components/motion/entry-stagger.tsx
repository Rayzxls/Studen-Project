"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * EntryStagger — coordinated fade-up reveal for a list (ADR-0029 § 2).
 *
 * Wraps a set of children; each fades up 8px on mount with a 40ms stagger.
 * The reveal *enhances* an already-rendered server payload — content is
 * present in the DOM; the animation only adds an entrance, so headless
 * renders + hidden tabs still show everything.
 *
 * Discipline:
 *  - Stagger caps at `maxStagger` items (default 12); beyond that all
 *    remaining children share the final delay so a 500-row list doesn't
 *    choreograph for 20 seconds.
 *  - prefers-reduced-motion: framer's useReducedMotion() short-circuits to
 *    no transform + no stagger (instant).
 *  - Uses the iOS spring curve to stay consistent with the rest of the
 *    system.
 */
const SPRING = [0.32, 0.72, 0, 1] as const;

export interface EntryStaggerProps {
  children: ReactNode[];
  /** Tag rendered as the container. Default "div". */
  as?: "div" | "ul" | "section";
  /** Per-item stagger in seconds. Default 0.04. */
  step?: number;
  /** Max number of items that stagger before the rest snap in. Default 12. */
  maxStagger?: number;
  className?: string;
  /** Class applied to each item wrapper. */
  itemClassName?: string;
}

export function EntryStagger({
  children,
  as = "div",
  step = 0.04,
  maxStagger = 12,
  className,
  itemClassName,
}: EntryStaggerProps) {
  const reduce = useReducedMotion();
  const MotionContainer = motion[as];
  const items = Array.isArray(children) ? children : [children];

  return (
    <MotionContainer className={className} initial={false}>
      {items.map((child, i) => {
        const delay = reduce ? 0 : Math.min(i, maxStagger) * step;
        return (
          <motion.div
            key={i}
            className={itemClassName}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce
                ? { duration: 0.1 }
                : { duration: 0.32, ease: SPRING, delay }
            }
          >
            {child}
          </motion.div>
        );
      })}
    </MotionContainer>
  );
}

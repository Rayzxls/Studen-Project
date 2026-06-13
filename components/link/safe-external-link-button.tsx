"use client";

import type { MouseEvent, ReactNode } from "react";

export function SafeExternalLinkButton({
  href,
  children,
  className,
  title,
  ariaLabel,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const keepParentCardStill = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={keepParentCardStill}
      className={className}
      title={title ?? `เปิดลิงก์ในแท็บใหม่ ${href}`}
      aria-label={ariaLabel ?? `Open external link in a new tab ${href}`}
    >
      {children}
    </a>
  );
}

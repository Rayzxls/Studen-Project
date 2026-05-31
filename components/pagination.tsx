import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationLinksProps {
  basePath: string;
  page: number;
  pageCount: number;
  searchParams?: Record<string, string | undefined>;
}

export function PaginationLinks({
  basePath,
  page,
  pageCount,
  searchParams = {},
}: PaginationLinksProps) {
  if (pageCount <= 1) return null;

  function makeUrl(p: number): string {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  }

  // Build page numbers shown: 1, ..., page-1, page, page+1, ..., last
  const pages: (number | "…")[] = [];
  const add = (n: number) => {
    if (!pages.includes(n)) pages.push(n);
  };
  add(1);
  for (let p = page - 1; p <= page + 1; p++) {
    if (p > 1 && p < pageCount) add(p);
  }
  if (pageCount > 1) add(pageCount);
  const withEllipsis: (number | "…")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (typeof p === "number") {
      if (prev && p - prev > 1) withEllipsis.push("…");
      withEllipsis.push(p);
      prev = p;
    }
  }

  return (
    <nav
      className="flex items-center justify-center gap-1"
      aria-label="pagination"
    >
      {page > 1 ? (
        <Link
          href={makeUrl(page - 1)}
          className="btn-ghost btn-sm"
          aria-label="หน้าก่อน"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <button className="btn-ghost btn-sm" disabled>
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}

      {withEllipsis.map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-2 text-ink-soft">
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-ink px-2 text-sm font-medium text-white"
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={makeUrl(p)}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm text-ink-soft hover:bg-slate-100"
          >
            {p}
          </Link>
        )
      )}

      {page < pageCount ? (
        <Link
          href={makeUrl(page + 1)}
          className="btn-ghost btn-sm"
          aria-label="หน้าถัดไป"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <button className="btn-ghost btn-sm" disabled>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </nav>
  );
}

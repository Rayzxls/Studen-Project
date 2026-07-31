// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TOUR_IDS, tourById, type TourId } from "@/lib/guide/tours";

/** The only attributes a tour may anchor to. */
const ANCHOR_ATTRIBUTES = [
  "data-guide",
  "data-guide-tab",
  "data-guide-nav",
] as const;

const SELECTOR = /^\[(data-guide|data-guide-tab|data-guide-nav)="([^"]+)"\]$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const sources = [...sourceFiles("app"), ...sourceFiles("components")]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

describe("guide tours", () => {
  it("resolves every declared tour", () => {
    for (const id of TOUR_IDS) {
      const tour = tourById(id);
      expect(tour.id).toBe(id);
      expect(tour.steps.length).toBeGreaterThan(0);
    }
  });

  it.each(TOUR_IDS)("%s has usable, non-repeating steps", (id: TourId) => {
    const { steps } = tourById(id);

    for (const step of steps) {
      expect(step.selector).toMatch(SELECTOR);
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.body.trim().length).toBeGreaterThan(0);
    }

    // A repeated selector would spotlight the same control twice.
    const selectors = steps.map((step) => step.selector);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it("anchors only through attributes the application actually sets", () => {
    // A tour addresses controls through data attributes rather than class
    // names. If an attribute stops being rendered, every step using it would
    // silently vanish at runtime, so check the mechanism still exists.
    for (const attribute of ANCHOR_ATTRIBUTES) {
      expect(sources).toContain(`${attribute}=`);
    }
  });

  it("points dashboard steps at links the navigation rail really renders", () => {
    // The rail sets data-guide-nav from each item's href, so a mistyped path
    // produces a selector that matches nothing and the step is skipped in
    // silence rather than failing.
    const rail = readFileSync(
      "components/dashboard/operating-shell.tsx",
      "utf8"
    );

    for (const id of TOUR_IDS) {
      for (const step of tourById(id).steps) {
        const match = SELECTOR.exec(step.selector);
        if (match?.[1] !== "data-guide-nav") continue;
        expect(rail).toContain(`href: "${match[2]}"`);
      }
    }
  });

  it("keeps course tours and dashboard tours on their own surfaces", () => {
    // A dashboard step cannot resolve inside a course and vice versa, so a
    // selector in the wrong tour would just be skipped and the person would
    // never be told about that part of the product.
    for (const id of TOUR_IDS) {
      const usesNav = tourById(id).steps.some((step) =>
        step.selector.startsWith("[data-guide-nav")
      );
      expect(usesNav).toBe(id.endsWith("-dashboard"));
    }
  });
});

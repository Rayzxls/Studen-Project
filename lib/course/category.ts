/**
 * Categorize a Thai grade level into one of 3 standard buckets.
 * Used by UI groupings (e.g. ClassPicker).
 *
 * Examples:
 *   "ป.1" → "ประถม"
 *   "ม.3" → "ม.ต้น"
 *   "ม.4" → "ม.ปลาย"
 *   anything else → "อื่นๆ"
 */
export type GradeCategory = "ประถม" | "ม.ต้น" | "ม.ปลาย" | "อื่นๆ";

/** Display order for UI rendering */
export const CATEGORY_ORDER: GradeCategory[] = [
  "ประถม",
  "ม.ต้น",
  "ม.ปลาย",
  "อื่นๆ",
];

export function gradeCategory(gradeLevel: string): GradeCategory {
  const trimmed = gradeLevel.trim();
  // Match "ป.X" or "ปX" with X = 1..6
  const matchP = trimmed.match(/^ป\.?\s?(\d+)/);
  if (matchP) {
    const num = parseInt(matchP[1], 10);
    if (num >= 1 && num <= 6) return "ประถม";
  }
  // Match "ม.X" or "มX" with X = 1..6
  const matchM = trimmed.match(/^ม\.?\s?(\d+)/);
  if (matchM) {
    const num = parseInt(matchM[1], 10);
    if (num >= 1 && num <= 3) return "ม.ต้น";
    if (num >= 4 && num <= 6) return "ม.ปลาย";
  }
  return "อื่นๆ";
}

/**
 * Stable sort key for class names so that e.g. "ม.4/2" < "ม.4/10"
 * Natural numeric ordering on the section number after the slash.
 */
export function classSortKey(className: string): [number, number] {
  // "ป.6/3" or "ม.4/12" → [6, 3] or [4, 12]
  const m = className.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  // Fallback: any leading number, then 0
  const n = className.match(/(\d+)/);
  return [n ? parseInt(n[1], 10) : 999, 0];
}

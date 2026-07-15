export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[\t\r ]*[=+\-@]/;

/**
 * Escape one RFC 4180 cell and neutralize spreadsheet formulas supplied
 * through user-controlled text such as names or report labels.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (typeof value === "string" && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(
  headers: readonly CsvCell[],
  rows: readonly (readonly CsvCell[])[]
): string {
  for (const row of rows) {
    if (row.length !== headers.length) {
      throw new Error("csv_column_count_mismatch");
    }
  }

  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

export function csvDownloadResponse(args: {
  body: string;
  filename: string;
  rowCount: number;
}): Response {
  const filename = args.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  return new Response(args.body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Report-Row-Count": String(args.rowCount),
    },
  });
}

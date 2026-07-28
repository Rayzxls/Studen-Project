import { redirect } from "next/navigation";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

/**
 * Compatibility route for bookmarks created before learning results became
 * course-oriented. The former term identifier is intentionally ignored.
 */
export default function StudentTermPage() {
  redirect("/student/terms");
}

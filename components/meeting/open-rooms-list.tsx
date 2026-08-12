import Link from "next/link";
import { Users, Video } from "lucide-react";

export interface OpenRoomSummary {
  sessionId: string;
  courseId: string;
  courseName: string;
  openedAt: Date;
  occupants: number;
}

/**
 * Every room open right now, across every course (ADR-0053).
 *
 * The app-level answer to "is anything happening", which no per-course page can
 * give. It links into the course's own room rather than joining from here: the
 * room page is where the roster, the stage and the controls already live, and
 * two places that can put someone into a call is one too many.
 */
export function OpenRoomsList({
  rooms,
  basePath,
  emptyTitle,
  emptyBody,
}: {
  rooms: readonly OpenRoomSummary[];
  /** "/teacher/courses" or "/student/courses". */
  basePath: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (rooms.length === 0) {
    return (
      <div className="card grid min-h-64 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Video className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-base font-medium text-ink">{emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-ink-mute">
            {emptyBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rooms.map((room) => (
        <li key={room.sessionId}>
          <Link
            href={`${basePath}/${room.courseId}/meeting`}
            className="card flex flex-wrap items-center gap-4 p-4 hover:no-underline"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
              <Video className="h-5 w-5" aria-hidden="true" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-ink">
                {room.courseName}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-mute">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {room.occupants > 0
                  ? `${room.occupants} คนในห้อง`
                  : "ยังไม่มีใครเข้าห้อง"}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-green-500"
              />
              เปิดอยู่
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

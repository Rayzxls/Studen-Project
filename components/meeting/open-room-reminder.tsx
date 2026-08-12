import Link from "next/link";
import type { Role } from "@prisma/client";
import { Video } from "lucide-react";

import { closeRoomFormAction } from "@/app/teacher/courses/[id]/meeting/actions";
import { openRoomsForTeacher } from "@/lib/meeting/room";

/**
 * The standing reminder that a room is still open (ADR-0053).
 *
 * Nothing closes a room on a timer — the owner chose that, so a lesson running
 * long is never cut off by a clock. The cost is a room left open after class,
 * inviting students into an empty call, and the agreed mitigation is not
 * automation but visibility: while a room is open its teacher sees this
 * wherever they are in the app, with the close control in it. Forgetting stays
 * possible; not noticing does not.
 *
 * Lives in the shared top bar because that is the only thing on every teacher
 * surface. Costs one indexed query per page load for teachers, and renders
 * nothing at all — no wrapper, no spacing — when no room is open, which is
 * almost always.
 *
 * Server-rendered rather than polled. The close control revalidates, and so
 * does the card on the course page, which are the two ways a room is ever
 * closed.
 */
export async function OpenRoomReminder({
  session,
}: {
  session: { user: { id: string; role: Role } } | null;
}) {
  if (session?.user.role !== "TEACHER") return null;

  const rooms = await openRoomsForTeacher({ teacherUserId: session.user.id });
  if (rooms.length === 0) return null;

  return (
    <div className="border-t border-orange-500/25 bg-orange-50 print:hidden">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-2 px-4 py-2 md:px-6">
        {rooms.map((room) => (
          <div
            key={room.sessionId}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-orange-700"
          >
            <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              ห้องเรียนออนไลน์ของ{" "}
              <Link
                href={`/teacher/courses/${room.courseId}/overview`}
                className="font-medium underline underline-offset-2"
              >
                {room.courseName}
              </Link>{" "}
              ยังเปิดอยู่
              {room.occupants > 0 ? ` · ${room.occupants} คนในห้อง` : ""}
            </span>

            <form action={closeRoomFormAction} className="ml-auto">
              <input type="hidden" name="courseId" value={room.courseId} />
              <input type="hidden" name="sessionId" value={room.sessionId} />
              <button
                type="submit"
                className="min-h-9 rounded-full border border-orange-500/25 px-3 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-500/10"
              >
                ปิดห้อง
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

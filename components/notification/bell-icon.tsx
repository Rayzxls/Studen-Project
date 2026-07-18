/**
 * Bell-row icon resolver — Phase 7 · P7-5
 *
 * Maps the `iconKey` string emitted by `lib/notification/preview` to a
 * lucide-react component. Kept separate from `preview.ts` so that
 * resolver stays plain TS (no JSX import in unit-test runner).
 */

import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Megaphone,
  MessageSquare,
  Pencil,
  RotateCcw,
  Undo2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Megaphone,
  MessageSquare,
  Pencil,
  RotateCcw,
  Undo2,
  UserPlus,
};

export function NotificationIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const Icon = MAP[iconKey] ?? Bell;
  return <Icon className={className} aria-hidden="true" />;
}

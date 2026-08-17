import type { RewardAchievementType } from "@prisma/client";

export function rewardAchievementLabel(type: RewardAchievementType): string {
  const labels: Record<RewardAchievementType, string> = {
    ASSIGNMENT_SUBMITTED: "ส่งงานสำเร็จ",
    ATTENDANCE_PRESENT: "เข้าเรียน",
    SCORE_THRESHOLD: "ทำคะแนนถึงเป้าหมาย",
    SYSTEM_QUEST: "เควสของระบบ",
  };
  return labels[type];
}

export function formatRewardDateTime(value: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

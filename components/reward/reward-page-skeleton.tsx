export function RewardPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดข้อมูลแต้ม"
      className="space-y-5 motion-safe:animate-pulse"
    >
      <div className="h-56 rounded-3xl border border-black/[0.06] bg-black/[0.04]" />
      <div className="space-y-3">
        <div className="h-5 w-36 rounded-full bg-black/[0.06]" />
        <div className="h-32 rounded-3xl border border-black/[0.06] bg-black/[0.035]" />
        <div className="h-32 rounded-3xl border border-black/[0.06] bg-black/[0.035]" />
      </div>
      <span className="sr-only">กำลังโหลดข้อมูลแต้ม</span>
    </div>
  );
}

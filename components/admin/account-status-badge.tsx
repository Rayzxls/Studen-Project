import type { AccountStatus } from "@/lib/account/status";

const STATUS_PRESENTATION: Record<
  AccountStatus,
  { label: string; dotClassName: string }
> = {
  ACTIVE: { label: "ใช้งาน", dotClassName: "bg-green-500" },
  SUSPENDED: { label: "ระงับชั่วคราว", dotClassName: "bg-orange-500" },
  DELETION_PENDING: { label: "รอลบบัญชี", dotClassName: "bg-amber-500" },
  TERMINATED: { label: "ยุติบัญชี", dotClassName: "bg-red-500" },
  ANONYMIZED: { label: "นิรนามแล้ว", dotClassName: "bg-ink-mute" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const presentation = STATUS_PRESENTATION[status];

  return (
    <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full border border-hairline-strong bg-surface px-2.5 py-1 text-[11px] font-medium text-ink">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${presentation.dotClassName}`}
      />
      {presentation.label}
    </span>
  );
}

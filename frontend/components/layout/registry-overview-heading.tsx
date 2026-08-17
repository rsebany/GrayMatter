"use client";

type Props = {
  title?: string;
  /** e.g. `Registered Studies` or `Registered Patients` */
  totalLabel: string;
  count: number;
  isLoading: boolean;
};

export function RegistryOverviewHeading({
  title = "Registry overview",
  totalLabel,
  count,
  isLoading,
}: Props) {
  return (
    <div className="min-w-0">
      <h1 className="text-[28px] font-medium leading-tight text-[var(--text-primary)]">
        {title}
      </h1>
      <p className="mt-1 break-words text-[13px] text-[var(--text-muted)]">
        {isLoading ? "Loading..." : `Total: ${count} ${totalLabel.toLowerCase()}`}
      </p>
    </div>
  );
}

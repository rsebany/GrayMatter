"use client";

type Props = {
  /** e.g. `Registered Studies` or `Registered Patients` */
  totalLabel: string;
  count: number;
  isLoading: boolean;
};

export function RegistryOverviewHeading({
  totalLabel,
  count,
  isLoading,
}: Props) {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-bold text-foreground sm:text-xl">Registry Overview</h2>
      <p className="break-words text-sm text-muted-foreground">
        {isLoading ? "Loading..." : `Total: ${count} ${totalLabel}`}
      </p>
    </div>
  );
}

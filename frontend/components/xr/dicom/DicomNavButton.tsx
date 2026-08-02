"use client";

export function DicomNavButton({
  onClick,
  disabled,
  direction,
}: {
  onClick: () => void;
  disabled: boolean;
  direction: "prev" | "next";
}) {
  const path = direction === "prev" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/90 shadow-lg transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
    >
      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={path} />
      </svg>
    </button>
  );
}

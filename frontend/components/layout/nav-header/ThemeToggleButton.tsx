import { Moon, Sun } from "lucide-react";

type ThemeToggleButtonProps = {
  darkMode: boolean;
  onToggle: () => void;
};

export function ThemeToggleButton({ darkMode, onToggle }: ThemeToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/70 hover:bg-muted"
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {darkMode ? (
        <Sun className="h-4 w-4 text-primary" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );
}

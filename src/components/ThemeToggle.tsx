import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative inline-flex h-8 w-14 items-center rounded-full border border-border/70 bg-muted/60 px-1 transition-colors duration-300 hover:border-primary/50 press"
    >
      <span
        className={`absolute inset-y-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isDark ? "translate-x-6" : "translate-x-0"
        }`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
      <Sun className={`ml-0.5 h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-40" : "opacity-0"}`} />
      <Moon className={`ml-auto mr-0.5 h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-0" : "opacity-40"}`} />
    </button>
  );
}

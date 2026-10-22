import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const isoToDmy = (iso?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

const dmyToIso = (dmy: string) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dmy.trim());
  if (!m) return "";
  const [, d, mo, y] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return "";
  return `${y}-${mo}-${d}`;
};

type DateInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
};

/** Date input that always displays dd-mm-yyyy, with a calendar picker button. Value stays ISO (yyyy-mm-dd). */
export function DateInput({ value, onChange, className, required, disabled, placeholder = "dd-mm-yyyy", id }: DateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => isoToDmy(value));

  useEffect(() => {
    setText(isoToDmy(value));
  }, [value]);

  const commit = (t: string) => {
    const iso = dmyToIso(t);
    if (iso) onChange?.(iso);
    else if (!t.trim()) onChange?.("");
    else setText(isoToDmy(value)); // invalid partial input: revert
  };

  const handleType = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    const t = parts.join("-");
    setText(t);
    if (digits.length === 8) {
      const iso = dmyToIso(t);
      if (iso) onChange?.(iso);
    }
  };

  return (
    <div className="relative w-full">
      <Input
        id={id}
        value={text}
        onChange={(e) => handleType(e.target.value)}
        onBlur={() => commit(text)}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        required={required}
        disabled={disabled}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => {
          const p = pickerRef.current;
          if (!p) return;
          try {
            p.showPicker();
          } catch {
            p.focus();
            p.click();
          }
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label="Open calendar"
      >
        <CalendarDays className="w-4 h-4" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-0 top-0 h-0 w-0 opacity-0 pointer-events-none"
        value={value || ""}
        onChange={(e) => {
          if (e.target.value) onChange?.(e.target.value);
        }}
      />
    </div>
  );
}

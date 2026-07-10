import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

interface DatePickerProps {
  /** ISO date string (YYYY-MM-DD) or null */
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  className?: string;
}

/**
 * DatePicker implemented WITHOUT a Portal-based Popover.
 * The calendar dropdown renders inline (position:absolute) inside the same DOM
 * subtree as the trigger, so it works correctly when nested inside a Sheet/Dialog
 * whose focus trap would otherwise block events on portal-rendered children.
 */
export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = value ? parseISO(value) : undefined;

  // Close when clicking/touching outside the container
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open]);

  const handleSelect = (day: Date | undefined) => {
    if (!day) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 w-full items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-sm font-normal shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          value ? "pr-8" : "",
          !value && "text-muted-foreground",
        )}
      >
        <CalendarDays size={14} className="shrink-0 opacity-60" />
        <span className="flex-1 truncate text-left">
          {value ? format(parseISO(value), "PPP") : placeholder}
        </span>
      </button>

      {/* Clear button — outside the trigger to avoid nested button */}
      {value && (
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange(null);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm opacity-50 hover:opacity-100 focus:outline-none"
          aria-label="Clear date"
        >
          <X size={12} />
        </button>
      )}

      {/* Inline calendar dropdown — no Portal, stays inside Sheet's DOM tree */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            classNames={{
              root: "p-3",
              month_caption: "flex items-center justify-between mb-2 px-1",
              caption_label: "text-sm font-medium",
              nav: "flex items-center gap-1",
              button_previous: "h-7 w-7 rounded-md border bg-transparent hover:bg-accent flex items-center justify-center",
              button_next: "h-7 w-7 rounded-md border bg-transparent hover:bg-accent flex items-center justify-center",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "w-9 text-center text-xs text-muted-foreground pb-1",
              week: "flex w-full mt-1",
              day: "relative p-0 text-center text-sm",
              day_button: "h-9 w-9 rounded-md text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
              today: "[&>button]:font-semibold [&>button]:underline",
              outside: "opacity-30",
              disabled: "opacity-30 cursor-not-allowed",
            }}
          />
        </div>
      )}
    </div>
  );
}

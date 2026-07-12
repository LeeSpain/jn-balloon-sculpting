"use client";

import { useMemo, useState } from "react";

// Client-side availability helpers. `unavailableDates` (blocked or fully-booked
// days) and `minDate` (lead-time floor) come from the server via PublicData, so
// the server stays the source of truth — this only mirrors it for the UI.
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function prettyDate(iso: string): string {
  return new Date(iso + "T12:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isDateAvailable(iso: string, minDate: string, unavailable: Set<string>): boolean {
  return !!iso && iso >= minDate && !unavailable.has(iso);
}

// Walk outwards from the requested date to find the closest bookable day before
// and after it — the "nearest available" suggestions.
export function nearestAvailable(
  target: string,
  minDate: string,
  unavailable: Set<string>,
  horizon = 180
): { before: string | null; after: string | null } {
  let before: string | null = null;
  let after: string | null = null;
  for (let i = 1; i <= horizon; i++) {
    if (!before) {
      const b = addDays(target, -i);
      if (isDateAvailable(b, minDate, unavailable)) before = b;
    }
    if (!after) {
      const a = addDays(target, i);
      if (isDateAvailable(a, minDate, unavailable)) after = a;
    }
    if (before && after) break;
  }
  return { before, after };
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function AvailabilityPicker({
  value,
  minDate,
  unavailableDates,
  onChange,
}: {
  value: string;
  minDate: string;
  unavailableDates: string[];
  onChange: (iso: string) => void;
}) {
  const unavailable = useMemo(() => new Set(unavailableDates || []), [unavailableDates]);
  // Which month is shown — defaults to the selected date's month, else the
  // earliest bookable month.
  const initial = value || minDate;
  const [cursor, setCursor] = useState(() => {
    const d = new Date((initial || new Date().toISOString().slice(0, 10)) + "T12:00");
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const firstShownMonth = { y: Number(minDate.slice(0, 4)), m: Number(minDate.slice(5, 7)) - 1 };
  const atFloor = cursor.y === firstShownMonth.y && cursor.m === firstShownMonth.m;

  // Build the grid — leading blanks so day 1 lands on the right weekday (Mon-first).
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Mon=0
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoOf(cursor.y, cursor.m, d));

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const nm = c.m + delta;
      return { y: c.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  };

  // Nearest-available suggestions when the customer has landed on an unavailable day.
  const selectedUnavailable = !!value && value >= minDate && unavailable.has(value);
  const suggestions = selectedUnavailable
    ? nearestAvailable(value, minDate, unavailable)
    : { before: null, after: null };

  return (
    <div>
      <div
        className="border-2 border-blush rounded-xl bg-cream p-3"
        role="group"
        aria-label="Choose a delivery date"
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={atFloor}
            aria-label="Previous month"
            className="rounded-full border-2 border-blush bg-white text-plum font-bold disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ width: 34, height: 34, lineHeight: "30px" }}
          >
            ‹
          </button>
          <span className="font-extrabold text-sm text-plum">{monthLabel}</span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="rounded-full border-2 border-blush bg-white text-plum font-bold"
            style={{ width: 34, height: 34, lineHeight: "30px" }}
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-center text-[11px] font-bold text-plum-soft">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <span key={`b${i}`} />;
            const dayNum = Number(iso.slice(8, 10));
            const beforeFloor = iso < minDate;
            const isUnavail = unavailable.has(iso);
            const disabled = beforeFloor;
            const selected = iso === value;
            const isToday = iso === todayISO;
            // Greyed = fully booked / blocked (still visible, with a tooltip);
            // faded = before the lead-time floor (not offerable at all).
            const title = beforeFloor
              ? "Too soon — needs more notice"
              : isUnavail
                ? "Fully booked"
                : prettyDate(iso);
            let style: React.CSSProperties = {
              minHeight: 40,
              borderWidth: 2,
              borderStyle: "solid",
            };
            if (selected) {
              style = { ...style, background: "#FF6F61", borderColor: "#FF6F61", color: "#fff" };
            } else if (disabled) {
              style = { ...style, background: "transparent", borderColor: "transparent", color: "#c9b8cb", cursor: "not-allowed" };
            } else if (isUnavail) {
              style = { ...style, background: "#EFE7EF", borderColor: "#EFE7EF", color: "#a58fa8", cursor: "not-allowed", textDecoration: "line-through" };
            } else {
              style = { ...style, background: "#fff", borderColor: "#F3C6C6", color: "#4A2C4D" };
            }
            return (
              <button
                key={iso}
                type="button"
                title={title}
                aria-label={`${prettyDate(iso)}${isUnavail ? " — fully booked" : ""}`}
                aria-pressed={selected}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => {
                  // Unavailable days are still clickable so we can show the
                  // "nearest available" helper instead of silently doing nothing.
                  onChange(iso);
                }}
                className="rounded-lg text-[13px] font-bold font-sans relative"
                style={style}
              >
                {dayNum}
                {isToday && !selected && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2"
                    style={{ bottom: 3, width: 4, height: 4, borderRadius: 9999, background: "#D4AF7A" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[11px] text-plum-soft">
          <span className="flex items-center gap-1">
            <span style={{ width: 11, height: 11, borderRadius: 3, background: "#fff", border: "2px solid #F3C6C6", display: "inline-block" }} />
            Available
          </span>
          <span className="flex items-center gap-1">
            <span style={{ width: 11, height: 11, borderRadius: 3, background: "#EFE7EF", display: "inline-block" }} />
            Fully booked
          </span>
        </div>
      </div>

      {selectedUnavailable && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2.5 rounded-xl text-[13px]"
          style={{ background: "#FFF3F1", border: "2px solid #FF6F61", padding: "12px 14px", color: "#c14a3e" }}
        >
          <p className="m-0 font-bold">
            We’re fully booked on {prettyDate(value)}.
          </p>
          {suggestions.before || suggestions.after ? (
            <>
              <p className="m-0 mt-0.5 mb-1.5 font-semibold">
                Our nearest available {suggestions.before && suggestions.after ? "days are" : "day is"}:
              </p>
              <div className="flex gap-2 flex-wrap">
                {suggestions.before && (
                  <button
                    type="button"
                    onClick={() => onChange(suggestions.before as string)}
                    className="cursor-pointer bg-white text-coral-deep font-extrabold text-[13px] rounded-full"
                    style={{ border: "2px solid #FF6F61", padding: "8px 16px", minHeight: 40 }}
                  >
                    {prettyDate(suggestions.before)}
                  </button>
                )}
                {suggestions.after && (
                  <button
                    type="button"
                    onClick={() => onChange(suggestions.after as string)}
                    className="cursor-pointer bg-white text-coral-deep font-extrabold text-[13px] rounded-full"
                    style={{ border: "2px solid #FF6F61", padding: "8px 16px", minHeight: 40 }}
                  >
                    {prettyDate(suggestions.after)}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="m-0 mt-0.5 font-semibold">
              Please get in touch and we’ll find you a date.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

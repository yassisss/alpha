"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Check,
  RotateCcw,
} from "lucide-react";

interface CustomDateTimePickerProps {
  value: string; // ISO-like "YYYY-MM-DDTHH:mm"
  onChange: (nextValue: string) => void;
}

const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const ARABIC_WEEKDAYS = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

function toLocalISOString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function parseLocalISO(value: string): Date {
  if (!value) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  return parsed;
}

export default function CustomDateTimePicker({
  value,
  onChange,
}: CustomDateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseLocalISO(value);

  // Calendar view state (month & year being browsed)
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth());

  useEffect(() => {
    const d = parseLocalISO(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  const closePopover = () => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, 170);
  };

  const togglePopover = () => {
    if (open) {
      closePopover();
    } else {
      setIsClosing(false);
      setOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        open &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closePopover();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Extract current date/time parts
  const selYear = selectedDate.getFullYear();
  const selMonth = selectedDate.getMonth();
  const selDay = selectedDate.getDate();
  const selHours24 = selectedDate.getHours();
  const selMinutes = selectedDate.getMinutes();
  const isPM = selHours24 >= 12;
  const selHours12 = selHours24 % 12 === 0 ? 12 : selHours24 % 12;

  const updateDatePart = (nextDate: Date) => {
    onChange(toLocalISOString(nextDate));
  };

  const handleSelectDay = (day: number) => {
    const next = new Date(selectedDate);
    next.setFullYear(viewYear);
    next.setMonth(viewMonth);
    next.setDate(day);
    updateDatePart(next);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleHourChange = (hour12: number) => {
    const next = new Date(selectedDate);
    let h24 = hour12 % 12;
    if (isPM) h24 += 12;
    next.setHours(h24);
    updateDatePart(next);
  };

  const handleMinuteChange = (minute: number) => {
    const next = new Date(selectedDate);
    next.setMinutes((minute + 60) % 60);
    updateDatePart(next);
  };

  const handlePeriodChange = (makePM: boolean) => {
    const next = new Date(selectedDate);
    let h24 = selHours24;
    if (makePM && h24 < 12) h24 += 12;
    if (!makePM && h24 >= 12) h24 -= 12;
    next.setHours(h24);
    updateDatePart(next);
  };

  const applyPresetHours = (hoursFromNow: number) => {
    const next = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    updateDatePart(next);
  };

  // Build calendar grid for (viewYear, viewMonth)
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const calendarCells: Array<{
    day: number;
    currentMonth: boolean;
  }> = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      currentMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({
      day: d,
      currentMonth: true,
    });
  }
  while (calendarCells.length < 42) {
    calendarCells.push({
      day: calendarCells.length - (firstDayOfMonth + daysInMonth) + 1,
      currentMonth: false,
    });
  }

  const today = new Date();
  const isTodayCell = (d: number) =>
    d === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  const isSelectedCell = (d: number) =>
    d === selDay && viewMonth === selMonth && viewYear === selYear;

  const formattedDisplay = `${selDay} ${ARABIC_MONTHS[selMonth]} ${selYear} • ${String(
    selHours12
  ).padStart(2, "0")}:${String(selMinutes).padStart(2, "0")} ${
    isPM ? "م" : "ص"
  }`;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger Button Styled Like Platform Inputs */}
      <button
        type="button"
        onClick={togglePopover}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border transition flex items-center justify-between text-xs font-bold ${
          open
            ? "border-indigo-600 ring-2 ring-indigo-600/20 text-slate-900 dark:text-white"
            : "border-slate-200 dark:border-slate-700 hover:border-indigo-500/60 text-slate-800 dark:text-slate-100"
        }`}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>{formattedDisplay}</span>
        </div>

        <span
          dir="ltr"
          className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] font-black"
        >
          {String(selDay).padStart(2, "0")}/{String(selMonth + 1).padStart(2, "0")}/{selYear}
        </span>
      </button>

      {/* Custom Frosted-Glass Popover */}
      {open && (
        <div
          className={`${
            isClosing ? "animate-dropdown-out" : "animate-dropdown-in"
          } absolute right-0 mt-2 z-50 w-[330px] sm:w-[460px] rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] p-4 space-y-4`}
        >
          {/* Quick Presets Row */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 ml-1">
              مدة سريعة:
            </span>
            {[
              { label: "24 ساعة", hours: 24 },
              { label: "3 أيام", hours: 72 },
              { label: "7 أيام", hours: 168 },
              { label: "30 يوم", hours: 720 },
            ].map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => applyPresetHours(preset.hours)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold transition"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Main Grid: Calendar + Time Selector */}
          <div className="grid sm:grid-cols-12 gap-4">
            {/* Calendar Column (7 cols) */}
            <div className="sm:col-span-7 space-y-3">
              {/* Month & Year Navigation */}
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition"
                  title="الشهر السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {ARABIC_MONTHS[viewMonth]} {viewYear}
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition"
                  title="الشهر التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 text-center">
                {ARABIC_WEEKDAYS.map((dayName) => (
                  <span
                    key={dayName}
                    className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1"
                  >
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (!cell.currentMonth) {
                    return (
                      <span
                        key={idx}
                        className="h-8 flex items-center justify-center text-[11px] font-mono text-slate-300 dark:text-slate-700 select-none"
                      >
                        {cell.day}
                      </span>
                    );
                  }

                  const selected = isSelectedCell(cell.day);
                  const todayMark = isTodayCell(cell.day);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectDay(cell.day)}
                      className={`h-8 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center ${
                        selected
                          ? "bg-indigo-600 text-white font-black shadow-md shadow-indigo-600/30"
                          : todayMark
                          ? "border border-indigo-500/60 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5"
                          : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Picker Column (5 cols) */}
            <div className="sm:col-span-5 flex flex-col justify-between rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 p-3 space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200 border-b border-slate-200/70 dark:border-slate-700/70 pb-2">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>تحديد الساعة</span>
              </div>

              {/* Hour & Minute Steppers */}
              <div dir="ltr" className="flex items-center justify-center gap-2">
                {/* Hour Control */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() =>
                      handleHourChange(selHours12 === 12 ? 1 : selHours12 + 1)
                    }
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="w-12 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono text-base font-black text-indigo-600 dark:text-indigo-400 shadow-sm">
                    {String(selHours12).padStart(2, "0")}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleHourChange(selHours12 === 1 ? 12 : selHours12 - 1)
                    }
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    ساعة
                  </span>
                </div>

                <span className="text-lg font-black text-slate-400 -mt-4">:</span>

                {/* Minute Control */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selMinutes + 5)}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <div className="w-12 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono text-base font-black text-indigo-600 dark:text-indigo-400 shadow-sm">
                    {String(selMinutes).padStart(2, "0")}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMinuteChange(selMinutes - 5)}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold text-slate-400">
                    دقيقة
                  </span>
                </div>
              </div>

              {/* AM / PM Toggle */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handlePeriodChange(false)}
                  className={`py-1.5 rounded-xl text-xs font-black transition ${
                    !isPM
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  صباحاً (AM)
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodChange(true)}
                  className={`py-1.5 rounded-xl text-xs font-black transition ${
                    isPM
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  مساءً (PM)
                </button>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200/70 dark:border-slate-800">
            <button
              type="button"
              onClick={() => applyPresetHours(24)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>غداً في نفس الموعد</span>
            </button>

            <button
              type="button"
              onClick={closePopover}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تأكيد الموعد</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


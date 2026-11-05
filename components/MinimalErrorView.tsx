"use client";

import React from "react";

interface MinimalErrorViewProps {
  code?: string | number;
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export default function MinimalErrorView({
  code = "500",
  message = "حدث خطأ غير متوقع في هذه الصفحة.",
  onRetry,
  fullScreen = true,
}: MinimalErrorViewProps) {
  return (
    <div
      className={`${
        fullScreen ? "min-h-[100dvh]" : "min-h-[260px] py-12"
      } w-full flex flex-col items-center justify-center px-4 select-none`}
    >
      <div className="flex items-center justify-center gap-4 text-slate-900 dark:text-slate-100">
        <span className="text-2xl font-bold tracking-tight">{code}</span>
        <div className="h-10 w-px bg-slate-300 dark:bg-slate-700" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-800/80 hover:bg-slate-300/70 dark:hover:bg-slate-700 transition"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}


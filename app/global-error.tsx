"use client";

import React from "react";
import MinimalErrorView from "@/components/MinimalErrorView";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="app-bg text-slate-900 dark:text-slate-100 min-h-screen">
        <MinimalErrorView
          code="500"
          message="حدث خطأ غير متوقع في المنصة."
          onRetry={() => reset()}
          fullScreen={true}
        />
      </body>
    </html>
  );
}


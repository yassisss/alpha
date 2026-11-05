"use client";

import React from "react";
import MinimalErrorView from "@/components/MinimalErrorView";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <MinimalErrorView
      code="500"
      message="حدث خطأ أثناء تحميل هذا القسم."
      onRetry={() => reset()}
      fullScreen={true}
    />
  );
}


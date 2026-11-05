"use client";

import React from "react";
import MinimalErrorView from "@/components/MinimalErrorView";

export default function NotFoundPage() {
  return (
    <MinimalErrorView
      code="404"
      message="هذه الصفحة غير موجودة."
      fullScreen={true}
    />
  );
}


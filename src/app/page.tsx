"use client";

import { useEffect } from "react";
import Toolkit from "@/components/Toolkit";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/state/auth";
import { AccessProvider } from "@/state/access";
import { installGlobalErrorHandlers } from "@/lib/reporting";

export default function Page() {
  // Catch async/event-handler errors that React error boundaries can't.
  useEffect(() => installGlobalErrorHandlers(), []);

  return (
    <AuthProvider>
      <AccessProvider>
        <ErrorBoundary>
          <Toolkit />
        </ErrorBoundary>
      </AccessProvider>
    </AuthProvider>
  );
}

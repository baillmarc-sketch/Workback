"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { installErrorCapture } from "@/lib/feedback/errorLog";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";

interface FeedbackCtx {
  /** Open the global feedback dialog from any trigger. */
  open: () => void;
}

const FeedbackContext = createContext<FeedbackCtx | null>(null);

/**
 * Owns the single feedback dialog so any trigger (footer link, header button)
 * opens the same modal, and installs global error capture once on mount so a
 * report can carry recent JS errors. Mounted inside AuthProvider (the dialog
 * reads the signed-in user for prefill/attribution).
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => installErrorCapture(), []);

  const open = useCallback(() => setIsOpen(true), []);
  const value = useMemo<FeedbackCtx>(() => ({ open }), [open]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {isOpen && <FeedbackDialog onClose={() => setIsOpen(false)} />}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackCtx {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}

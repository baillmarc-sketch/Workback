"use client";

import { Component, type ReactNode } from "react";
import { reportError } from "@/lib/reporting";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes anywhere below it so a single bad component (or a
 * corrupt doc that slips past migrate) shows a recoverable message instead of a
 * blank white screen. Errors are funneled to reportError. Sits inside the auth/
 * access providers so the fallback still has the app shell.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    reportError(error, { boundary: "app", componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
          <h2 className="font-display text-[20px] font-semibold">Something went wrong</h2>
          <p className="max-w-sm text-[13px] text-ink-soft">
            The page hit an unexpected error. Your saved work is safe — reloading usually fixes it.
          </p>
          <button
            className="rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper hover:opacity-85"
            onClick={() => location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

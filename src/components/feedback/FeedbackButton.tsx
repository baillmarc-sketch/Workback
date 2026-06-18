"use client";

import { useFeedback } from "@/state/feedback";

/**
 * Trigger for the global feedback dialog. `inline` matches the bordered header
 * buttons (sits next to Sign in); `footer` matches the underlined footer links.
 */
export default function FeedbackButton({
  variant = "inline",
  className = "",
}: {
  variant?: "inline" | "footer";
  className?: string;
}) {
  const { open } = useFeedback();

  if (variant === "footer") {
    return (
      <button
        className={`font-medium underline-offset-2 hover:text-ink-soft hover:underline ${className}`}
        onClick={open}
      >
        Send feedback
      </button>
    );
  }

  return (
    <button
      className={`rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-soft hover:text-ink ${className}`}
      onClick={open}
      title="Report a bug or share an idea"
    >
      Feedback
    </button>
  );
}

"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Password input with a show/hide (eye) button, as NIST SP 800-63B recommends.
 * Hidden by default; the button only switches the input type, so the password
 * never leaves this input.
 */
export function PasswordField({
  className,
  id = "password",
  autoComplete = "current-password",
  what = "password",
}: {
  className: string;
  /** Also the form field name; the page's <label htmlFor> must match it. */
  id?: string;
  autoComplete?: "current-password" | "new-password";
  /** Used in the eye button's name ("Show new password"), so several fields stay distinct. */
  what?: string;
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        className={`${className} pr-11`}
      />
      <button
        type="button"
        aria-label={visible ? `Hide ${what}` : `Show ${what}`}
        aria-pressed={visible}
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai-blue)] transition-colors"
      >
        <Icon className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
}

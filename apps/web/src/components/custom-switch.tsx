"use client";

import * as React from "react";

interface CustomSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

export function CustomSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  "aria-label": ariaLabel,
}: CustomSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-cyan-500" : "bg-[#1E1E2E]"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg
          transition-transform duration-200 ease-in-out
          ${checked ? "translate-x-[22px]" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}

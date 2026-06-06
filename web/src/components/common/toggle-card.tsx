"use client";

import type { InputHTMLAttributes } from "react";

type ToggleCardProps = {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  name?: string;
  className?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "disabled" | "onChange">;
};

export function ToggleCard({
  label,
  description,
  checked,
  disabled = false,
  onChange,
  name,
  className,
  inputProps,
}: ToggleCardProps) {
  const classes = [
    "toggle-card",
    checked ? "toggle-card--checked" : null,
    disabled ? "toggle-card--disabled" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={classes}>
      <input
        {...inputProps}
        className="sr-only"
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="toggle-card__label">{label}</span>
        {description ? <span className="toggle-card__description">{description}</span> : null}
      </span>
      <span className={["toggle-switch", checked ? "toggle-switch--checked" : null].filter(Boolean).join(" ")} aria-hidden="true">
        <span className="toggle-switch__thumb" />
      </span>
    </label>
  );
}

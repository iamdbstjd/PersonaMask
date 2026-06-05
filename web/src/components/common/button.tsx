"use client";

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  }
>;

export function Button({
  children,
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = [
    "app-button",
    `app-button--${variant}`,
    size === "sm" ? "app-button--sm" : null,
    fullWidth ? "app-button--full" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}

import clsx from "clsx";
import React from "react";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
}) {
  return (
    <button
      className={clsx(
        "px-4 py-2 text-sm font-medium transition",
        variant === "primary" && "bg-emerald-800 text-white hover:bg-emerald-700",
        variant === "secondary" && "bg-base-850 text-text-base hover:bg-base-800",
        variant === "outline" &&
          "border border-emerald-800 text-emerald-200 hover:bg-base-850",
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-md px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-md px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Chip({
  label,
  selected = false
}: {
  label: string;
  selected?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs",
        selected
          ? "border-emerald-800 bg-emerald-800 text-white"
          : "border-emerald-800 text-emerald-200"
      )}
    >
      {label}
    </span>
  );
}

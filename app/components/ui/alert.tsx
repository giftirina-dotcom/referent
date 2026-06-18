import type { HTMLAttributes, ReactNode } from "react";

type AlertVariant = "default" | "destructive" | "warning";

const VARIANT_STYLES: Record<
  AlertVariant,
  { root: string; icon: string; title: string; description: string }
> = {
  default: {
    root: "border-zinc-200 bg-zinc-50 text-zinc-900",
    icon: "text-zinc-600",
    title: "text-zinc-900",
    description: "text-zinc-700",
  },
  destructive: {
    root: "border-red-200 bg-red-50 text-red-950",
    icon: "text-red-600",
    title: "text-red-950",
    description: "text-red-800",
  },
  warning: {
    root: "border-amber-200 bg-amber-50 text-amber-950",
    icon: "text-amber-600",
    title: "text-amber-950",
    description: "text-amber-900",
  },
};

function AlertIcon({ variant }: { variant: AlertVariant }) {
  const className = VARIANT_STYLES[variant].icon;

  if (variant === "destructive") {
    return (
      <svg
        aria-hidden
        className={className}
        fill="none"
        height="16"
        viewBox="0 0 24 24"
        width="16"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          d="M12 8v4M12 16h.01"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Alert({
  variant = "default",
  title,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
}) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      role="alert"
      className={`relative w-full rounded-xl border px-4 py-3 text-sm ${styles.root} ${className}`}
      {...props}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">
          <AlertIcon variant={variant} />
        </div>
        <div className="min-w-0 space-y-1">
          {title ? (
            <p className={`font-medium leading-none ${styles.title}`}>{title}</p>
          ) : null}
          <div className={`min-w-0 break-words leading-6 [overflow-wrap:anywhere] ${styles.description}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

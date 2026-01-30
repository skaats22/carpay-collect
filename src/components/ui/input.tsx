import * as React from "react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-white " +
          "placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };

import * as React from "react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50";

    const variants: Record<string, string> = {
      default: "bg-white/10 hover:bg-white/15 border border-white/10",
      outline: "bg-transparent hover:bg-white/10 border border-white/15",
      ghost: "bg-transparent hover:bg-white/10 border border-transparent",
    };

    // keep a reasonable default size; your app often overrides via className
    const size = "h-9 px-3 py-2";

    return (
      <button ref={ref} className={cn(base, variants[variant], size, className)} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button };

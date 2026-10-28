import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
  {
    variants: {
      variant: {
        gold: "bg-gold text-bg hover:bg-gold/85",
        oxide: "bg-oxide text-bg hover:bg-oxide/85",
        ghost: "border border-line bg-transparent text-fg hover:bg-raised",
        raised: "border border-line bg-raised text-fg hover:border-gold/60",
      },
      size: {
        md: "h-12 px-4 text-base",
        sm: "h-11 px-3 text-sm",
        lg: "h-14 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

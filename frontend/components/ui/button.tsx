import { cloneElement, isValidElement, type ReactElement } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-200 ease-out active:scale-[0.985] active:duration-0 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-accent-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(15_70_56/0.25)] hover:bg-accent-800",
        secondary: "bg-surface text-ink shadow-1 hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-ink/6 hover:text-ink",
        ai: "bg-ai-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_1px_2px_rgb(44_40_104/0.25)] hover:bg-ai-900",
        danger: "bg-danger-100 text-danger-700 hover:bg-danger-200",
        link: "h-auto rounded-none px-0 text-accent-700 underline-offset-4 hover:underline",
        // shadcn aliases used by a couple of stock primitives
        default: "bg-accent-700 text-white hover:bg-accent-800",
        outline: "bg-surface text-ink shadow-1 hover:bg-surface-2",
        destructive: "bg-danger-100 text-danger-700 hover:bg-danger-200",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-9 px-3.5",
        lg: "h-10 px-4 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-9 px-3.5",
        xs: "h-7 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  render,
  nativeButton = render === undefined,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants> & { loading?: boolean }) {
  // Links styled as buttons stay real links: no role="button", native Enter handling, right-click/open-in-tab work.
  if (isValidElement(render)) {
    const el = render as ReactElement<{ className?: string; children?: React.ReactNode }>;
    return cloneElement(el, {
      className: cn(buttonVariants({ variant, size, className }), el.props.className),
      children: children,
    });
  }
  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      nativeButton={nativeButton}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };

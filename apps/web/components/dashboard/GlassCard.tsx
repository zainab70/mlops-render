import type { ComponentPropsWithoutRef } from "react";

type GlassCardProps = ComponentPropsWithoutRef<"section"> & {
  /** Grows slightly on hover (the design's status and stats cards). */
  hover?: boolean;
};

/** The design's GlassCard (docs/figma/dashboard.md): the .glass-card panel, rounded and padded. */
export function GlassCard({
  hover = false,
  className = "",
  children,
  ...rest
}: GlassCardProps) {
  const classes = [
    "glass-card rounded-2xl p-6",
    hover && "hover:scale-[1.02] transition-transform duration-300",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={classes} {...rest}>
      {children}
    </section>
  );
}

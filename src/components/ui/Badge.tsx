import type { ReactNode } from "react";
import type { Tone } from "./StatTile";
import "./badge.css";

type BadgeProps = {
  children: ReactNode;
  tone?: Tone | "neutral";
  dot?: boolean;
  upper?: boolean;
};

export function Badge({ children, tone = "neutral", dot, upper }: BadgeProps) {
  return (
    <span className={["badge", `badge--${tone}`, upper && "badge--upper"].filter(Boolean).join(" ")}>
      {dot && <span className="badge__dot" aria-hidden />}
      {children}
    </span>
  );
}

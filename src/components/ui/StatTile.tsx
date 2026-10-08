import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import "./stat-tile.css";

export type Tone = "blue" | "violet" | "amber" | "green" | "teal" | "rose";

type StatTileProps = {
  icon: LucideIcon;
  label: string;
  value: number | string;
  caption: string;
  tone: Tone;
  to?: string;
};

export function StatTile({ icon: Icon, label, value, caption, tone, to }: StatTileProps) {
  const className = `stat-tile stat-tile--${tone}`;
  const inner = (
    <>
      <span className="stat-tile__icon">
        <Icon size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <span className="stat-tile__label">{label}</span>
      <span className="stat-tile__value">{value}</span>
      <span className="stat-tile__caption">{caption}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

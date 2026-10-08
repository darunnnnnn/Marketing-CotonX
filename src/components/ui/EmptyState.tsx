import type { LucideIcon } from "lucide-react";
import "./empty-state.css";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  hint?: string;
};

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {Icon && (
        <span className="empty-state__icon">
          <Icon size={20} strokeWidth={1.75} aria-hidden />
        </span>
      )}
      <p className="empty-state__title">{title}</p>
      {hint && <p className="empty-state__hint">{hint}</p>}
    </div>
  );
}

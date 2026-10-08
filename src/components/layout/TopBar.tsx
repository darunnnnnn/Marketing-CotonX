import { Bell, Settings } from "lucide-react";
import "./top-bar.css";

type TopBarProps = {
  title: string;
  notifications?: number;
};

export function TopBar({ title, notifications = 0 }: TopBarProps) {
  return (
    <header className="top-bar">
      <h1 className="top-bar__title">{title}</h1>
      <div className="top-bar__actions">
        <button type="button" className="top-bar__icon-btn" aria-label="Settings">
          <Settings size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          className="top-bar__icon-btn"
          aria-label={`Notifications (${notifications} unread)`}
        >
          <Bell size={20} strokeWidth={1.75} aria-hidden />
          {notifications > 0 && <span className="top-bar__count">{notifications}</span>}
        </button>
        <span className="top-bar__divider" aria-hidden />
        <button type="button" className="top-bar__avatar" aria-label="Account">
          C
        </button>
      </div>
    </header>
  );
}

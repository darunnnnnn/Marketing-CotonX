import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { ChevronDown, LogOut } from "lucide-react";
import { isGroup, navigation } from "./navigation";
import { useAuth } from "../../lib/auth/useAuth";
import type { NavLeaf } from "./navigation";
import "./sidebar.css";

function Leaf({ item, nested }: { item: NavLeaf; nested?: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === "/"}
        className={({ isActive }) => ["sidebar__link", isActive && "is-active"].filter(Boolean).join(" ")}
      >
        <span className="sidebar__icon">
          <Icon size={nested ? 16 : 20} strokeWidth={1.75} aria-hidden />
        </span>
        <span className="sidebar__label">{item.label}</span>
        {item.count !== undefined && item.count > 0 && (
          <>
            <span className="sidebar__pip" aria-hidden />
            <span className="sidebar__count">{item.count}</span>
          </>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const { session, profile, signOut, configured } = useAuth();
  const [openGroups, setOpenGroups] = useState<string[]>(() =>
    navigation
      .filter(isGroup)
      .filter((group) => group.children.some((child) => pathname.startsWith(child.to)))
      .map((group) => group.label),
  );

  const toggle = (label: string) =>
    setOpenGroups((open) =>
      open.includes(label) ? open.filter((item) => item !== label) : [...open, label],
    );

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark">C</span>
        <span className="sidebar__wordmark sidebar__label">COTONEX</span>
      </div>

      <nav className="sidebar__nav" aria-label="Main">
        <ul>
          {navigation.map((item) => {
            if (!isGroup(item)) return <Leaf key={item.to} item={item} />;

            const Icon = item.icon;
            const open = openGroups.includes(item.label);
            const pending = item.children.reduce((sum, child) => sum + (child.count ?? 0), 0);

            return (
              <li key={item.label}>
                <button
                  type="button"
                  className="sidebar__group-toggle"
                  aria-expanded={open}
                  onClick={() => toggle(item.label)}
                >
                  <span className="sidebar__icon">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="sidebar__label">{item.label}</span>
                  {pending > 0 && <span className="sidebar__pip" aria-hidden />}
                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    className={["sidebar__chevron", open && "is-open"].filter(Boolean).join(" ")}
                    aria-hidden
                  />
                </button>
                <ul className={["sidebar__sub", open && "is-open"].filter(Boolean).join(" ")}>
                  {item.children.map((child) => (
                    <Leaf key={child.to} item={child} nested />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="sidebar__avatar">
            {(profile?.email ?? session?.user.email ?? "C")[0].toUpperCase()}
          </span>
          <div className="sidebar__user-meta">
            <div className="sidebar__user-name">
              {profile?.email ?? session?.user.email ?? "Seed data (no project)"}
            </div>
            <div className="sidebar__user-role">
              {configured ? (profile?.role ?? "no profile") : "offline"}
            </div>
          </div>
        </div>
        <button type="button" className="sidebar__signout" onClick={() => void signOut()}>
          <span className="sidebar__icon">
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="sidebar__label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

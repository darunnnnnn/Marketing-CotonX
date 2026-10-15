import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AskFab } from "./AskFab";
import { navigation, isGroup } from "./navigation";
import { Guard } from "../../routes/Guard";
import "./app-shell.css";

function titleFor(pathname: string): string {
  for (const item of navigation) {
    if (isGroup(item)) {
      const match = item.children.find((child) => child.to === pathname);
      if (match) return `${item.label} — ${match.label}`;
    } else if (item.to === pathname) {
      return item.label === "Dashboard" ? "Marketing Dashboard" : item.label;
    }
  }
  return "Marketing Dashboard";
}

export function AppShell() {
  const { pathname } = useLocation();

  return (
    <Guard>
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <TopBar title={titleFor(pathname)} notifications={0} />
        <div className="app-shell__content">
          <Outlet />
        </div>
      </div>
      <AskFab />
    </div>
    </Guard>
  );
}

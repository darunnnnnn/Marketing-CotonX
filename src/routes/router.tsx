import { createBrowserRouter } from "react-router";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
  Globe2,
  Mail,
  Megaphone,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Dashboard } from "./dashboard/Dashboard";
import { Placeholder } from "./Placeholder";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "buyers/companies", element: <Placeholder icon={Building2} title="Companies" phase="Phase 1" /> },
      { path: "buyers/contacts", element: <Placeholder icon={Users} title="Contacts" phase="Phase 1" /> },
      { path: "buyers/review", element: <Placeholder icon={CheckCircle2} title="Review Queue" phase="Phase 3" /> },
      { path: "segments", element: <Placeholder icon={Globe2} title="Segments" phase="Phase 3" /> },
      { path: "sources/email", element: <Placeholder icon={Mail} title="Email Sync" phase="Phase 2" /> },
      { path: "sources/apollo", element: <Placeholder icon={Database} title="Apollo" phase="Phase 4" /> },
      { path: "sources/imports", element: <Placeholder icon={Workflow} title="Imports" phase="Phase 4" /> },
      { path: "campaigns", element: <Placeholder icon={Megaphone} title="Campaigns" phase="Phase 5" /> },
      { path: "campaigns/templates", element: <Placeholder icon={Mail} title="Templates" phase="Phase 5" /> },
      { path: "campaigns/approvals", element: <Placeholder icon={CheckCircle2} title="Approvals" phase="Phase 5" /> },
      { path: "schedule", element: <Placeholder icon={CalendarClock} title="Schedule" phase="Phase 5" /> },
      { path: "activity", element: <Placeholder icon={BarChart3} title="Activity" phase="Phase 6" /> },
      { path: "settings", element: <Placeholder icon={Settings} title="Settings" phase="Phase 1" /> },
    ],
  },
]);

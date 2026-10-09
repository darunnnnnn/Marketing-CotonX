import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
  Globe2,
  LayoutDashboard,
  Inbox,
  Mail,
  Megaphone,
  Radio,
  Search,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavLeaf = {
  label: string;
  to: string;
  icon: LucideIcon;
  count?: number;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};

export type NavItem = NavLeaf | NavGroup;

export const isGroup = (item: NavItem): item is NavGroup => "children" in item;

export const navigation: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  {
    label: "Buyer Database",
    icon: Database,
    children: [
      { label: "Lookup", to: "/buyers/lookup", icon: Search },
      { label: "Companies", to: "/buyers/companies", icon: Building2 },
      { label: "Contacts", to: "/buyers/contacts", icon: Users },
      { label: "Review Queue", to: "/buyers/review", icon: CheckCircle2 },
    ],
  },
  { label: "Segments", to: "/segments", icon: Globe2 },
  {
    label: "Sources",
    icon: Workflow,
    children: [
      { label: "Mailbox Ingest", to: "/sources/ingest", icon: Inbox },
      { label: "Email Sync", to: "/sources/email", icon: Mail },
      { label: "Apollo", to: "/sources/apollo", icon: Database },
      { label: "Imports", to: "/sources/imports", icon: Workflow },
    ],
  },
  {
    label: "Campaigns",
    icon: Megaphone,
    children: [
      { label: "All Campaigns", to: "/campaigns", icon: Megaphone },
      { label: "Templates", to: "/campaigns/templates", icon: Mail },
      { label: "Approvals", to: "/campaigns/approvals", icon: CheckCircle2 },
    ],
  },
  { label: "Schedule", to: "/schedule", icon: CalendarClock },
  { label: "Activity", to: "/activity", icon: BarChart3 },
  { label: "Channels", to: "/channels", icon: Radio },
  { label: "Settings", to: "/settings", icon: Settings },
];

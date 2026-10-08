import {
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Globe2,
  LayoutDashboard,
  Mail,
  Megaphone,
  Database,
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

/* Counts are placeholders until the Supabase schema lands in Phase 1. */
export const navigation: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  {
    label: "Buyer Database",
    icon: Database,
    children: [
      { label: "Companies", to: "/buyers/companies", icon: Building2 },
      { label: "Contacts", to: "/buyers/contacts", icon: Users },
      { label: "Review Queue", to: "/buyers/review", icon: CheckCircle2, count: 0 },
    ],
  },
  { label: "Segments", to: "/segments", icon: Globe2 },
  {
    label: "Sources",
    icon: Workflow,
    children: [
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
      { label: "Approvals", to: "/campaigns/approvals", icon: CheckCircle2, count: 0 },
    ],
  },
  { label: "Schedule", to: "/schedule", icon: CalendarClock },
  { label: "Activity", to: "/activity", icon: BarChart3 },
  { label: "Settings", to: "/settings", icon: Settings },
];

import { createBrowserRouter } from "react-router";
import { Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Dashboard } from "./dashboard/Dashboard";
import { Lookup } from "./buyers/Lookup";
import { Companies } from "./buyers/Companies";
import { Contacts } from "./buyers/Contacts";
import { Review } from "./buyers/Review";
import { Segments } from "./segments/Segments";
import { EmailSync } from "./sources/EmailSync";
import { Apollo } from "./sources/Apollo";
import { Imports } from "./sources/Imports";
import { Campaigns } from "./campaigns/Campaigns";
import { CampaignDetail } from "./campaigns/CampaignDetail";
import { Templates } from "./campaigns/Templates";
import { Approvals } from "./campaigns/Approvals";
import { Schedule } from "./schedule/Schedule";
import { Activity } from "./activity/Activity";
import { Channels } from "./channels/Channels";
import { Placeholder } from "./Placeholder";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },

      { path: "buyers/lookup", element: <Lookup /> },
      { path: "buyers/companies", element: <Companies /> },
      { path: "buyers/contacts", element: <Contacts /> },
      { path: "buyers/review", element: <Review /> },

      { path: "segments", element: <Segments /> },

      { path: "sources/email", element: <EmailSync /> },
      { path: "sources/apollo", element: <Apollo /> },
      { path: "sources/imports", element: <Imports /> },

      { path: "campaigns", element: <Campaigns /> },
      { path: "campaigns/templates", element: <Templates /> },
      { path: "campaigns/approvals", element: <Approvals /> },
      { path: "campaigns/:id", element: <CampaignDetail /> },

      { path: "schedule", element: <Schedule /> },
      { path: "activity", element: <Activity /> },
      { path: "channels", element: <Channels /> },

      { path: "settings", element: <Placeholder icon={SettingsIcon} title="Settings" phase="Phase 1" /> },
    ],
  },
]);

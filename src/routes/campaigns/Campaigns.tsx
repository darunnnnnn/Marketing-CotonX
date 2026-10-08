import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Megaphone } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { repo } from "../../lib/domain/repository";
import { CAMPAIGN_KIND_LABELS } from "../../lib/domain/types";
import type { Campaign, CampaignStatus } from "../../lib/domain/types";
import type { Tone } from "../../components/ui/StatTile";
import "../../styles/table.css";

const STATUS_TONE: Record<CampaignStatus, Tone | "neutral"> = {
  draft: "neutral",
  pending_approval: "amber",
  approved: "blue",
  scheduled: "violet",
  running: "green",
  paused: "rose",
  done: "neutral",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  running: "Running",
  paused: "Paused",
  done: "Finished",
};

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    void repo.listCampaigns().then(setCampaigns);
  }, []);

  return (
    <div className="page">
      <p className="page__lead">
        A campaign targets one or more countries and runs a sequence of steps.
        Contacts resume where they left off rather than restarting at the
        introduction, so re-running a market never repeats a message someone
        has already had.
      </p>

      <Card flushBody>
        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Type</th>
                  <th>Countries</th>
                  <th className="table__num">Steps</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link to={`/campaigns/${campaign.id}`} className="table__primary">
                        {campaign.name}
                      </Link>
                      <div className="table__sub">
                        created {new Date(campaign.createdAt).toLocaleDateString("en-GB")}
                      </div>
                    </td>
                    <td>{CAMPAIGN_KIND_LABELS[campaign.kind]}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {campaign.countryCodes.map((code) => (
                          <span key={code} className="flag__code">
                            {code}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="table__num">{campaign.steps.length}</td>
                    <td>
                      <Badge tone="neutral">{campaign.channel}</Badge>
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[campaign.status]} dot={campaign.status === "running"}>
                        {STATUS_LABEL[campaign.status]}
                      </Badge>
                    </td>
                    <td className="table__sub">
                      {campaign.approvedBy
                        ? `${campaign.approvedBy} · ${new Date(campaign.approvedAt!).toLocaleDateString("en-GB")}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

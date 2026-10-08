import type { LucideIcon } from "lucide-react";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";

type PlaceholderProps = {
  icon: LucideIcon;
  title: string;
  phase: string;
};

/* Routes exist from Phase 0 so navigation is real and nothing 404s while the
   features behind them are built out phase by phase. */
export function Placeholder({ icon, title, phase }: PlaceholderProps) {
  return (
    <Card title={title} flushBody>
      <EmptyState icon={icon} title={`${title} arrives in ${phase}`} hint="The route and shell are in place; the feature is not built yet." />
    </Card>
  );
}

import {
  Client360Demo,
  ContextualAgendaDemo,
  MobileWorkDemo,
  OrqenaActionDemo,
  RolePortalStudio,
  SalesQuoteStudioDemo,
  TreasuryFlowDemo,
  Work360Demo,
} from "@/components/marketing/product-scenes";

export function MarketingScene({ name }: { name: string }) {
  switch (name) {
    case "Client360Demo": return <Client360Demo />;
    case "ContextualAgendaDemo": return <ContextualAgendaDemo />;
    case "MobileWorkDemo": return <MobileWorkDemo />;
    case "OrqenaActionDemo": return <OrqenaActionDemo />;
    case "RolePortalStudio": return <RolePortalStudio />;
    case "SalesQuoteStudioDemo": return <SalesQuoteStudioDemo />;
    case "TreasuryFlowDemo": return <TreasuryFlowDemo />;
    case "Work360Demo": return <Work360Demo />;
    default: return <Client360Demo />;
  }
}

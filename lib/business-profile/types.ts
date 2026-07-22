export const organizationTypes = ["SELF_EMPLOYED", "COMPANY"] as const;
export type OrganizationTypeKey = (typeof organizationTypes)[number];

export const sectorKeys = ["general_services", "construction", "installations", "professional_services", "consulting", "agency", "repair_workshop", "healthcare", "education", "retail", "hospitality", "real_estate", "other"] as const;
export type SectorKey = (typeof sectorKeys)[number];

export type SectorTerminology = {
  workSingular: string; workPlural: string; owner: string; progress: string;
  clientSingular: string; clientPlural: string;
};

export type SectorProfile = {
  key: SectorKey; name: string; description: string; icon: string;
  terminology: SectorTerminology; examples: string[]; quickActions: string[];
  suggestedWorkTypes: string[]; recommendedFields: string[]; kpis: string[];
  documentCategories: string[]; agendaTemplates: string[]; assistantSuggestions: string[];
};

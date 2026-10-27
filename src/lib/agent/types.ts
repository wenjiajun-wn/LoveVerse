export type Citation = {
  id: string;
  memoryId: string;
  title: string;
  date: string;
  place: string;
  paragraph: number;
  excerpt: string;
  revision: string;
  sourcePath: string;
};
export type AgentAnswer = {
  facts: { text: string; sources: string[] }[];
  inferences: { text: string; sources: string[] }[];
  unknowns: string[];
  citations: Citation[];
};
export type ConsentStatus = {
  available: boolean;
  enabled: boolean;
  ready: boolean;
  memberCount: number;
  approvals: number;
  selected: { id: string; revision: string }[];
  sharedIds: string[];
};

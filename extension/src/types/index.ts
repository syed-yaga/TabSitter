export interface TabInfo {
  id?: number;
  url: string;
  title: string;
  favIconUrl?: string;
}

export interface OllamaAnalysis {
  summary: string;
  intent: string;
  suggestedProject: string;
}

export interface SavedPagePayload {
  url: string;
  title: string;
  summary: string;
  intent: string;
  suggestedProject: string;
  embedding: number[];
  status?: string;
}

export interface SavedPageRecord {
  id: string;
  userId: string;
  url: string;
  title: string;
  summary: string;
  intent?: string;
  projectId?: string;
  status: string;
  createdAt: string;
  score?: number;
  project?: {
    id: string;
    name: string;
  };
}

export interface ProjectRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  savedPages: SavedPageRecord[];
}

export interface HammockStatus {
  step: "idle" | "extracting" | "analyzing" | "embedding" | "saving" | "closing" | "completed" | "error";
  currentTabTitle?: string;
  currentIndex: number;
  totalTabs: number;
  errorMessage?: string;
}

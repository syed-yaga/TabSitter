import { SavedPagePayload, SavedPageRecord, ProjectRecord } from "../types";

const DEFAULT_API_URL = "http://localhost:3000";

async function getBaseApiUrl(): Promise<string> {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    const result = await chrome.storage.local.get("apiUrl");
    if (result && result.apiUrl) {
      return result.apiUrl.replace(/\/$/, "");
    }
  }
  return DEFAULT_API_URL;
}

/**
 * Saves pages to the backend.
 * Returns { ok: boolean, status: number, data: any }
 */
export async function savePagesToBackend(
  pages: SavedPagePayload[]
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  try {
    const baseUrl = await getBaseApiUrl();
    const response = await fetch(`${baseUrl}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pages),
    });

    const data = await response.json().catch(() => ({}));

    return {
      ok: response.status === 200,
      status: response.status,
      data,
      error: response.ok ? undefined : data.error || `HTTP ${response.status}`,
    };
  } catch (error: any) {
    console.error("API savePages error:", error);
    return {
      ok: false,
      status: 0,
      error: error.message || "Could not connect to TabSitter Cloud API",
    };
  }
}

/**
 * Executes a semantic search with a 768-dim query vector.
 */
export async function searchPagesBackend(
  queryVector: number[]
): Promise<{ success: boolean; results: SavedPageRecord[]; error?: string }> {
  try {
    const baseUrl = await getBaseApiUrl();
    const response = await fetch(`${baseUrl}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embedding: queryVector }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Search failed with status ${response.status}`);
    }

    return {
      success: true,
      results: data.results || [],
    };
  } catch (error: any) {
    console.error("API searchPages error:", error);
    return {
      success: false,
      results: [],
      error: error.message,
    };
  }
}

/**
 * Lists projects and their saved pages.
 */
export async function fetchProjectsBackend(): Promise<ProjectRecord[]> {
  try {
    const baseUrl = await getBaseApiUrl();
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects (HTTP ${response.status})`);
    }

    const data = await response.json();
    return data.projects || [];
  } catch (error: any) {
    console.error("fetchProjects error:", error);
    return [];
  }
}

/**
 * Lists all saved pages directly.
 */
export async function fetchPagesBackend(): Promise<SavedPageRecord[]> {
  try {
    const baseUrl = await getBaseApiUrl();
    const response = await fetch(`${baseUrl}/api/pages`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pages (HTTP ${response.status})`);
    }

    const data = await response.json();
    return data.pages || [];
  } catch (error: any) {
    console.error("fetchPages error:", error);
    return [];
  }
}

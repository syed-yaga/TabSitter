import { OllamaAnalysis } from "../types";

const OLLAMA_BASE_URL = "http://localhost:11434";
const GENERATION_MODEL = "gemma2:2b";
const EMBEDDING_MODEL = "nomic-embed-text";

export class OllamaOfflineError extends Error {
  constructor(message = "Local AI engine is offline. Please start Ollama.") {
    super(message);
    this.name = "OllamaOfflineError";
  }
}

/**
 * Checks if local Ollama daemon is reachable.
 */
export async function checkOllamaHealth(): Promise<{
  online: boolean;
  message?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      return { online: true };
    }
    return {
      online: false,
      message: `Ollama returned status ${response.status}`,
    };
  } catch (error: any) {
    return {
      online: false,
      message: "Local AI engine is offline. Please start Ollama.",
    };
  }
}

/**
 * Calls local Ollama /api/generate with gemma2 to extract:
 * { "summary": "...", "intent": "...", "suggestedProject": "..." }
 */
export async function analyzePageWithGemma(
  pageText: string,
  pageTitle: string,
): Promise<OllamaAnalysis> {
  const truncatedText = pageText.trim().slice(0, 4000);
  const prompt = `You are TabSitter's intent extractor. Analyze this webpage text:
Title: "${pageTitle}"
Content:
${truncatedText}

Analyze this text. Return strictly a JSON object with keys: 'summary', 'intent', and 'suggestedProject'.
- "summary": A concise 1-2 sentence overview of what this page explains.
- "intent": Why the user kept this tab open (e.g. "Reviewing Docker deployment steps", "Comparing pricing tiers").
- "suggestedProject": A concise 2-3 word cluster name (e.g. "DevOps Infrastructure", "Frontend Learning", "Research").

Strictly output raw JSON only with no markdown backticks, no preamble, and no explanation.`;

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GENERATION_MODEL,
        prompt: prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama generate responded with status ${response.status}`,
      );
    }

    const data = await response.json();
    const rawResponse = data.response || "{}";

    // Parse JSON safely
    try {
      const parsed = JSON.parse(rawResponse);
      return {
        summary: parsed.summary || `${pageTitle} overview`,
        intent: parsed.intent || `Reading ${pageTitle}`,
        suggestedProject: parsed.suggestedProject || "General Research",
      };
    } catch {
      // Regex extraction fallback if response had surrounding text
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        return {
          summary: extracted.summary || `${pageTitle} overview`,
          intent: extracted.intent || `Reading ${pageTitle}`,
          suggestedProject: extracted.suggestedProject || "General Research",
        };
      }
      return {
        summary: rawResponse.slice(0, 200),
        intent: `Browsing ${pageTitle}`,
        suggestedProject: "General Research",
      };
    }
  } catch (error: any) {
    console.error("Ollama generate error:", error);
    if (
      error.name === "AbortError" ||
      error.message?.includes("Failed to fetch") ||
      error.code === "ECONNREFUSED"
    ) {
      throw new OllamaOfflineError();
    }
    throw error;
  }
}

/**
 * Calls local Ollama /api/embeddings with nomic-embed-text to produce 768-dim vector.
 */
export async function getEmbeddingFromOllama(text: string): Promise<number[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text.slice(0, 2000),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama embeddings responded with status ${response.status}`,
      );
    }

    const data = await response.json();
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid embedding response from Ollama");
    }

    return data.embedding;
  } catch (error: any) {
    console.error("Ollama embedding error:", error);
    if (
      error.name === "AbortError" ||
      error.message?.includes("Failed to fetch") ||
      error.code === "ECONNREFUSED"
    ) {
      throw new OllamaOfflineError();
    }
    throw error;
  }
}

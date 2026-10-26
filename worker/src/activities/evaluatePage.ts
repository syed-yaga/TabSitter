import dotenv from "dotenv";

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma2";
const API_URL = process.env.API_URL || "http://localhost:3000";

export interface EvaluationResult {
  updated: boolean;
  reason: string;
  extractedContent: string;
  statusUpdated: boolean;
}

/**
 * Temporal Activity: extractAndEvaluatePage
 *
 * 1. Initializes Browserbase Stagehand (or fallback scraper).
 * 2. Navigates to url and calls page.extract({ instruction: "Extract the core content or pricing details" }).
 * 3. Calls local Ollama to evaluate semantic change against user intent:
 *    "Compare this old summary: [oldSummary] with this new content: [extractedContent].
 *     Did the following update occur: [intent]? Answer Yes or No with a 1-sentence reason."
 * 4. If Yes, sends PUT request to Cloud API to update page status to "reawakened".
 */
export async function extractAndEvaluatePage(
  urlOrParams: string | { url: string; oldSummary: string; intent: string; savedPageId?: string },
  argOldSummary?: string,
  argIntent?: string,
  argSavedPageId?: string
): Promise<EvaluationResult> {
  let url = "";
  let oldSummary = "";
  let intent = "";
  let savedPageId: string | undefined;

  if (typeof urlOrParams === "object" && urlOrParams !== null) {
    url = urlOrParams.url;
    oldSummary = urlOrParams.oldSummary;
    intent = urlOrParams.intent;
    savedPageId = urlOrParams.savedPageId;
  } else {
    url = urlOrParams;
    oldSummary = argOldSummary || "";
    intent = argIntent || "";
    savedPageId = argSavedPageId;
  }

  console.log(`[Activity: extractAndEvaluatePage] Checking: ${url}`);
  console.log(`[Activity: extractAndEvaluatePage] Target Intent: "${intent}"`);

  let extractedContent = "";
  let stagehandInstance: any = null;

  // 1. Extract content using Stagehand
  try {
    const { Stagehand } = await import("@browserbasehq/stagehand");

    stagehandInstance = new Stagehand({
      env: process.env.BROWSERBASE_API_KEY ? "BROWSERBASE" : "LOCAL",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      headless: true,
      verbose: 0,
    });

    await stagehandInstance.init();
    const page = stagehandInstance.page;

    console.log(`[Stagehand] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    let extraction: any = null;
    try {
      extraction = await (page as any).extract("Extract the core content or pricing details");
    } catch {
      extraction = await (page as any).extract({
        instruction: "Extract the core content or pricing details",
      });
    }

    if (extraction) {
      extractedContent =
        typeof extraction === "string"
          ? extraction
          : extraction.extraction || JSON.stringify(extraction);
    }

    await stagehandInstance.close();
    stagehandInstance = null;
  } catch (stagehandError: any) {
    if (stagehandInstance) {
      await stagehandInstance.close().catch(() => {});
      stagehandInstance = null;
    }
    console.warn(
      `[Stagehand Warning] Direct Stagehand run encountered: ${stagehandError.message}. Using resilient HTTP fetch fallback.`
    );

    // Resilient fallback: standard text extraction
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 TabSitter Sloth Bot/1.0" },
      });
      const html = await response.text();
      // Simple HTML tags stripper for plain text
      extractedContent = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 4000);
    } catch (fetchError: any) {
      console.error(`[Scrape Error] Failed to fetch url ${url}:`, fetchError.message);
      extractedContent = "Failed to extract page content.";
    }
  }

  // 2. Local Ollama Semantic Comparison (Prompt as strictly specified)
  const prompt = `Compare this old summary: [${oldSummary}] with this new content: [${extractedContent}]. Did the following update occur: [${intent}]? Answer Yes or No with a 1-sentence reason.`;

  console.log(`[Ollama Inference] Prompting local model '${OLLAMA_MODEL}'...`);
  let answer = "";

  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama returned status ${ollamaResponse.status}`);
    }

    const data = (await ollamaResponse.json()) as any;
    answer = (data.response || "").trim();
    console.log(`[Ollama Response] ${answer}`);
  } catch (ollamaError: any) {
    console.error(`[Ollama Error] Local AI failed:`, ollamaError.message);
    answer = `No - Ollama evaluation failed: ${ollamaError.message}`;
  }

  // Check if answer starts with "Yes"
  const isYes = /^yes/i.test(answer) || answer.toLowerCase().startsWith("yes");
  let statusUpdated = false;

  // 3. If Yes, make a PUT request to the Render/Cloud API to update page status to "reawakened"
  if (isYes && savedPageId) {
    console.log(`[Reawakening] Target intent satisfied! Updating page ${savedPageId} to 'reawakened'...`);
    try {
      const putRes = await fetch(`${API_URL}/api/pages/${savedPageId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reawakened" }),
      });

      if (putRes.ok) {
        statusUpdated = true;
        console.log(`[Reawakening] Page ${savedPageId} status successfully set to 'reawakened'.`);
      } else {
        console.warn(`[Reawakening Warning] PUT status returned ${putRes.status}`);
      }
    } catch (apiError: any) {
      console.error(`[Reawakening Error] Failed to contact API:`, apiError.message);
    }
  }

  return {
    updated: isYes,
    reason: answer,
    extractedContent: extractedContent.slice(0, 300),
    statusUpdated,
  };
}

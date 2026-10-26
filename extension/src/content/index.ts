import { Readability } from "@mozilla/readability";

/**
 * Sanitizes and extracts the primary content from the current DOM.
 * Strips navbars, footers, sidebars, ads, cookie notices, and scripts.
 */
export function extractCleanContent(): { text: string; title: string; url: string } {
  const title = document.title || "";
  const url = window.location.href;

  try {
    // Clone document so readability doesn't mutate current page view
    const documentClone = document.cloneNode(true) as Document;

    // Aggressively remove noise elements
    const noiseSelectors = [
      "nav",
      "footer",
      "header",
      "aside",
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "[role='banner']",
      "[role='navigation']",
      "[role='complementary']",
      "[aria-hidden='true']",
      ".ad",
      ".ads",
      ".advertisement",
      "[class*='ad-']",
      "[id*='ad-']",
      "[class*='cookie']",
      "[id*='cookie']",
      ".sidebar",
      "#sidebar",
    ];

    noiseSelectors.forEach((selector) => {
      try {
        const els = documentClone.querySelectorAll(selector);
        els.forEach((el) => el.remove());
      } catch {
        // ignore selector errors
      }
    });

    let cleanText = "";

    // 1. Try Mozilla Readability parser
    try {
      const reader = new Readability(documentClone, {
        charThreshold: 50,
      });
      const parsedArticle = reader.parse();
      if (parsedArticle && parsedArticle.textContent && parsedArticle.textContent.trim().length > 60) {
        cleanText = parsedArticle.textContent;
      }
    } catch (readabilityError) {
      console.warn("Readability parse fallback:", readabilityError);
    }

    // 2. Fallback to <article> or <main>
    if (!cleanText || cleanText.length < 60) {
      const mainElement =
        documentClone.querySelector("article") ||
        documentClone.querySelector("main") ||
        documentClone.querySelector("[role='main']") ||
        documentClone.body;

      if (mainElement) {
        cleanText = mainElement.textContent || "";
      }
    }

    // Normalize whitespace
    const normalized = cleanText
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    return {
      title,
      url,
      text: normalized.slice(0, 8000), // Cap at 8,000 characters for local LLM context
    };
  } catch (error) {
    console.error("Content extraction failed:", error);
    return {
      title,
      url,
      text: (document.body?.innerText || "").slice(0, 4000),
    };
  }
}

// Listen for direct messages from extension popup
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === "EXTRACT_PAGE_CONTENT") {
      const extracted = extractCleanContent();
      sendResponse(extracted);
    }
    return true;
  });
}

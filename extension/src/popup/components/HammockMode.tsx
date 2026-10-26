import React, { useState, useEffect } from "react";
import {
  BedDouble,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
} from "lucide-react";
import { TabInfo, SavedPagePayload, HammockStatus } from "../../types";
import {
  analyzePageWithGemma,
  getEmbeddingFromOllama,
  OllamaOfflineError,
} from "../../services/ollama";
import { savePagesToBackend } from "../../services/api";

interface HammockModeProps {
  ollamaOnline: boolean;
  onOllamaError: () => void;
  onRefreshClusters: () => void;
}

export const HammockMode: React.FC<HammockModeProps> = ({
  ollamaOnline,
  onOllamaError,
  onRefreshClusters,
}) => {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [loadingTabs, setLoadingTabs] = useState(true);
  const [status, setStatus] = useState<HammockStatus>({
    step: "idle",
    currentIndex: 0,
    totalTabs: 0,
  });

  // Load active window tabs
  const loadTabs = async () => {
    setLoadingTabs(true);
    try {
      if (typeof chrome !== "undefined" && chrome.tabs) {
        const queryOptions = { currentWindow: true };
        const windowTabs = await chrome.tabs.query(queryOptions);

        // Filter out non-scriptable tabs (e.g. chrome://, edge://, about:)
        const validTabs = windowTabs.filter(
          (t) =>
            t.url &&
            (t.url.startsWith("http://") || t.url.startsWith("https://")),
        );

        setTabs(validTabs);
        setSelectedTabIds(new Set(validTabs.map((t) => t.id!).filter(Boolean)));
      } else {
        // Mock data for preview in non-extension environment
        const mockTabs: any[] = [
          {
            id: 1,
            title: "Building Durable Workflows - Temporal Docs",
            url: "https://docs.temporal.io",
          },
          {
            id: 2,
            title: "Prisma with MongoDB Vector Search",
            url: "https://prisma.io/docs",
          },
          {
            id: 3,
            title: "Ollama Gemma 2 Model Card",
            url: "https://ollama.com/library/gemma2",
          },
        ];
        setTabs(mockTabs);
        setSelectedTabIds(new Set([1, 2, 3]));
      }
    } catch (err) {
      console.error("Failed to query tabs:", err);
    } finally {
      setLoadingTabs(false);
    }
  };

  useEffect(() => {
    loadTabs();

    // Check if there was an in-progress hammock state in storage
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(["hammockProgress"], (res) => {
        if (res.hammockProgress && res.hammockProgress.step !== "idle") {
          setStatus(res.hammockProgress);
        }
      });
    }
  }, []);

  const toggleTabSelection = (tabId: number) => {
    const next = new Set(selectedTabIds);
    if (next.has(tabId)) {
      next.delete(tabId);
    } else {
      next.add(tabId);
    }
    setSelectedTabIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedTabIds.size === tabs.length) {
      setSelectedTabIds(new Set());
    } else {
      setSelectedTabIds(new Set(tabs.map((t) => t.id!).filter(Boolean)));
    }
  };

  /**
   * Extracts clean DOM content from a given tab.
   * Uses scripting API with fallback to title.
   */
  const extractTabContent = async (
    tab: chrome.tabs.Tab,
  ): Promise<{ text: string; title: string; url: string }> => {
    const defaultData = {
      title: tab.title || "Untitled Tab",
      url: tab.url || "",
      text: tab.title || "",
    };

    if (typeof chrome === "undefined" || !chrome.scripting || !tab.id) {
      return defaultData;
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            // Strip noise elements
            const clone = document.cloneNode(true) as Document;
            const selectors =
              "nav, footer, header, aside, script, style, noscript, iframe, svg, [role='banner'], [role='navigation'], [aria-hidden='true'], [class*='ad-'], [id*='ad-']";
            clone.querySelectorAll(selectors).forEach((el) => el.remove());

            // Extract main or article or body
            const mainEl =
              clone.querySelector("article") ||
              clone.querySelector("main") ||
              clone.querySelector("[role='main']") ||
              clone.body;

            const text = (mainEl?.textContent || "")
              .replace(/[\r\n\t]+/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim()
              .slice(0, 8000);

            return {
              title: document.title || "",
              url: window.location.href,
              text: text || document.title,
            };
          } catch {
            return {
              title: document.title,
              url: window.location.href,
              text: document.title,
            };
          }
        },
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      return defaultData;
    } catch (scriptError) {
      console.warn(`Extraction fallback for tab ${tab.id}:`, scriptError);
      return defaultData;
    }
  };

  /**
   * Main Hammock Mode Execution Flow
   */
  const startHammockMode = async () => {
    const tabsToProcess = tabs.filter((t) => t.id && selectedTabIds.has(t.id));
    if (tabsToProcess.length === 0) return;

    if (!ollamaOnline) {
      onOllamaError();
      return;
    }

    const total = tabsToProcess.length;
    const compiledPayloads: SavedPagePayload[] = [];
    const processedTabIds: number[] = [];

    // Helper to cache progress state in chrome.storage.local
    const updateProgress = async (newStatus: HammockStatus) => {
      setStatus(newStatus);
      if (
        typeof chrome !== "undefined" &&
        chrome.tabs &&
        processedTabIds.length > 0
      ) {
        for (const tabId of processedTabIds) {
          try {
            await chrome.tabs.remove(tabId);
          } catch {
            // Tab was already closed or discarded manually; ignore safely
          }
        }
      }
    };

    try {
      for (let i = 0; i < total; i++) {
        const tab = tabsToProcess[i];
        processedTabIds.push(tab.id!);

        // 1. Extract DOM content
        await updateProgress({
          step: "extracting",
          currentTabTitle: tab.title,
          currentIndex: i + 1,
          totalTabs: total,
        });
        const extracted = await extractTabContent(tab);

        // 2. Local AI Intent & Summary (Ollama Gemma 2)
        await updateProgress({
          step: "analyzing",
          currentTabTitle: tab.title,
          currentIndex: i + 1,
          totalTabs: total,
        });
        const analysis = await analyzePageWithGemma(
          extracted.text,
          extracted.title,
        );

        // 3. Local Embedding (Ollama Nomic 768-dim)
        await updateProgress({
          step: "embedding",
          currentTabTitle: tab.title,
          currentIndex: i + 1,
          totalTabs: total,
        });
        const embedding = await getEmbeddingFromOllama(analysis.summary);

        compiledPayloads.push({
          url: extracted.url || tab.url!,
          title: extracted.title || tab.title || "Untitled Tab",
          summary: analysis.summary,
          intent: analysis.intent,
          suggestedProject: analysis.suggestedProject,
          embedding: embedding,
          status: "hibernating",
        });
      }

      // 4. Send compiled payloads to Render/Local Cloud API
      await updateProgress({
        step: "saving",
        currentIndex: total,
        totalTabs: total,
      });

      const apiResponse = await savePagesToBackend(compiledPayloads);

      // 5. CRITICAL SAFETY CONSTRAINT:
      // ONLY execute chrome.tabs.remove(tabIds) if API returns 200 OK
      if (apiResponse.ok && apiResponse.status === 200) {
        await updateProgress({
          step: "closing",
          currentIndex: total,
          totalTabs: total,
        });

        if (
          typeof chrome !== "undefined" &&
          chrome.tabs &&
          processedTabIds.length > 0
        ) {
          await chrome.tabs.remove(processedTabIds);
        }

        // Clear stored progress cache
        if (
          typeof chrome !== "undefined" &&
          chrome.storage &&
          chrome.storage.local
        ) {
          await chrome.storage.local.remove("hammockProgress");
        }

        await updateProgress({
          step: "completed",
          currentIndex: total,
          totalTabs: total,
        });

        onRefreshClusters();
      } else {
        throw new Error(
          `Safety trigger: Cloud API returned status ${apiResponse.status} (${apiResponse.error || "error"}). Tabs were preserved and NOT closed.`,
        );
      }
    } catch (err: any) {
      console.error("Hammock mode error:", err);
      if (err instanceof OllamaOfflineError) {
        onOllamaError();
      }
      const errorMsg =
        err.message || "An unexpected error occurred during hibernation.";
      await updateProgress({
        step: "error",
        currentIndex: 0,
        totalTabs: total,
        errorMessage: errorMsg,
      });
    }
  };

  const resetStatus = () => {
    setStatus({ step: "idle", currentIndex: 0, totalTabs: 0 });
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.remove("hammockProgress");
    }
    loadTabs();
  };

  // Processing state view
  if (status.step !== "idle" && status.step !== "error") {
    const isCompleted = status.step === "completed";
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[380px] text-center">
        {isCompleted ? (
          <div className="animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-950/60">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-base font-bold text-emerald-300">
              Tabs Peacefully Sleeping!
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-[280px]">
              {status.totalTabs} tabs safely summarized, embedded, and
              hibernated into your memory canopy.
            </p>
            <button
              onClick={resetStatus}
              className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md transition active:scale-95"
            >
              Back to Hammock
            </button>
          </div>
        ) : (
          <div className="w-full max-w-[320px]">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 animate-pulse">
              <BedDouble className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              {status.step === "extracting" && "Reading & Sanitizing DOM..."}
              {status.step === "analyzing" &&
                "Extracting Intent with Gemma 2..."}
              {status.step === "embedding" &&
                "Vectorizing with Nomic (768d)..."}
              {status.step === "saving" && "Saving to Cloud API..."}
              {status.step === "closing" && "Safely Closing Hibernated Tabs..."}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {status.currentTabTitle || "Processing tab bundle..."}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden border border-slate-700/50">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${status.totalTabs > 0 ? (status.currentIndex / status.totalTabs) * 100 : 15}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Tab {status.currentIndex} of {status.totalTabs}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Error state view
  if (status.step === "error") {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[380px] text-center">
        <div className="w-12 h-12 rounded-full bg-rose-950/60 border border-rose-600/50 flex items-center justify-center text-rose-400 mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-rose-200">
          Hibernation Paused
        </h3>
        <p className="text-xs text-slate-300 mt-1.5 max-w-[300px] leading-relaxed">
          {status.errorMessage}
        </p>
        <p className="text-[11px] text-amber-300/90 mt-2 font-medium">
          🛡️ No tabs were closed to prevent accidental data loss.
        </p>
        <button
          onClick={resetStatus}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
        >
          Dismiss & Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Top Controls */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-200">
            Open Tabs
          </span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-mono">
            {tabs.length}
          </span>
        </div>
        <button
          onClick={toggleSelectAll}
          className="text-[11px] text-amber-400 hover:text-amber-300 transition"
        >
          {selectedTabIds.size === tabs.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      {/* Tabs List */}
      {loadingTabs ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Scanning open window...</span>
        </div>
      ) : tabs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          No scriptable web tabs open in this window.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {tabs.map((tab) => {
            const isSelected = selectedTabIds.has(tab.id!);
            return (
              <div
                key={tab.id}
                onClick={() => toggleTabSelection(tab.id!)}
                className={`p-2 rounded-lg border text-left cursor-pointer transition flex items-center gap-2.5 ${
                  isSelected
                    ? "bg-slate-900/90 border-amber-600/40 text-slate-200 shadow-sm"
                    : "bg-slate-950/40 border-slate-800/60 text-slate-500 opacity-60 hover:opacity-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="rounded border-slate-700 text-amber-600 focus:ring-0 cursor-pointer"
                />
                {tab.favIconUrl ? (
                  <img
                    src={tab.favIconUrl}
                    alt=""
                    className="w-4 h-4 shrink-0 rounded"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <Globe className="w-4 h-4 shrink-0 text-slate-500" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {tab.title || "Untitled"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {tab.url}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hammock Mode Action Button */}
      <div className="mt-3 pt-2 border-t border-slate-800/80">
        <button
          onClick={startHammockMode}
          disabled={selectedTabIds.size === 0}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <BedDouble className="w-4 h-4" />
          <span>Swing into Hammock Mode ({selectedTabIds.size} tabs)</span>
        </button>
        <p className="text-[10px] text-center text-slate-400 mt-1.5">
          Safely extracts intent & closes tabs only upon successful cloud
          storage.
        </p>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { Search, Sparkles, ExternalLink, Loader2, Compass } from "lucide-react";
import { SavedPageRecord } from "../../types";
import { getEmbeddingFromOllama, OllamaOfflineError } from "../../services/ollama";
import { searchPagesBackend } from "../../services/api";

interface SemanticSearchProps {
  ollamaOnline: boolean;
  onOllamaError: () => void;
}

export const SemanticSearch: React.FC<SemanticSearchProps> = ({
  ollamaOnline,
  onOllamaError,
}) => {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SavedPageRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    if (!ollamaOnline) {
      onOllamaError();
      return;
    }

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      // 1. Vectorize query with local nomic-embed-text via Ollama
      const queryVector = await getEmbeddingFromOllama(query.trim());

      // 2. Call backend /api/search with 768-dim vector
      const searchRes = await searchPagesBackend(queryVector);

      if (searchRes.success) {
        setResults(searchRes.results);
      } else {
        setSearchError(searchRes.error || "Search failed");
      }
    } catch (err: any) {
      console.error("Semantic search error:", err);
      if (err instanceof OllamaOfflineError) {
        onOllamaError();
      }
      setSearchError(err.message || "Failed to vectorize query");
    } finally {
      setSearching(false);
    }
  };

  const openTab = (url: string) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="p-3">
      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Lazy query... (e.g., 'docker auth bug fix')"
          className="w-full pl-9 pr-16 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 transition shadow-inner"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="absolute right-1.5 top-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition disabled:opacity-40 flex items-center gap-1 active:scale-95 cursor-pointer"
        >
          {searching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          <span>Search</span>
        </button>
      </form>

      {/* Suggested Lazy Prompts */}
      {!hasSearched && (
        <div className="mt-4 px-1 text-left">
          <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
            Try a vague query:
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              "Where was that pricing comparison?",
              "Database vector search setup",
              "Agentic workflow retry strategy",
              "Frontend sloth theme ideas",
            ].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(suggestion);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition text-left cursor-pointer"
              >
                "{suggestion}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
          {searchError}
        </div>
      )}

      {/* Search Results */}
      <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {searching && (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Embedding query with Nomic & querying Atlas...</span>
          </div>
        )}

        {!searching && hasSearched && results.length === 0 && !searchError && (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <Compass className="w-6 h-6 text-slate-600" />
            <span>No matching sleeping tabs found in memory.</span>
          </div>
        )}

        {!searching &&
          results.map((item) => {
            const similarityPercent = item.score ? Math.round(item.score * 100) : null;
            return (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition text-left shadow-sm group"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 group-hover:text-emerald-400 transition">
                    {item.title}
                  </h4>
                  {similarityPercent !== null && (
                    <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {similarityPercent}% match
                    </span>
                  )}
                </div>

                {item.intent && (
                  <p className="mt-1 text-[11px] text-amber-300/90 font-medium line-clamp-1">
                    🎯 Intent: {item.intent}
                  </p>
                )}

                <p className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 truncate max-w-[220px]">
                    {new URL(item.url).hostname}
                  </span>
                  <button
                    onClick={() => openTab(item.url)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-medium transition cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Reopen Tab</span>
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

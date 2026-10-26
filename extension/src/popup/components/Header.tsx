import React from "react";
import { BedDouble, Sparkles, RefreshCw } from "lucide-react";

interface HeaderProps {
  ollamaOnline: boolean;
  onRefreshHealth: () => void;
  activeTab: "hammock" | "search" | "clusters";
  setActiveTab: (tab: "hammock" | "search" | "clusters") => void;
}

export const Header: React.FC<HeaderProps> = ({
  ollamaOnline,
  onRefreshHealth,
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="px-4 pt-3 pb-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <BedDouble className="w-4 h-4 text-amber-100" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide flex items-center gap-1.5 text-slate-100">
              TabSitter
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Local AI
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">The Browser Tab Sloth</p>
          </div>
        </div>

        {/* Ollama Health Pill */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onRefreshHealth}
            title="Check Ollama status"
            className="group p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
          </button>
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              ollamaOnline
                ? "bg-emerald-950/60 text-emerald-400 border-emerald-700/50"
                : "bg-rose-950/60 text-rose-400 border-rose-700/50"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ollamaOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            <span>{ollamaOnline ? "Ollama Ready" : "Ollama Offline"}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800/80">
        <button
          onClick={() => setActiveTab("hammock")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "hammock"
              ? "bg-amber-600/90 text-amber-50 shadow-sm shadow-amber-900/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <BedDouble className="w-3.5 h-3.5" />
          Hammock
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "search"
              ? "bg-emerald-600/90 text-emerald-50 shadow-sm shadow-emerald-900/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Lazy Recall
        </button>
        <button
          onClick={() => setActiveTab("clusters")}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "clusters"
              ? "bg-indigo-600/90 text-indigo-50 shadow-sm shadow-indigo-900/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          Clusters
        </button>
      </div>
    </header>
  );
};

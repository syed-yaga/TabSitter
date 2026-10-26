import React from "react";
import { AlertTriangle, Terminal, RefreshCw } from "lucide-react";

interface OllamaOfflineBannerProps {
  onRetry: () => void;
  retrying?: boolean;
}

export const OllamaOfflineBanner: React.FC<OllamaOfflineBannerProps> = ({
  onRetry,
  retrying = false,
}) => {
  return (
    <div className="m-3 p-3.5 rounded-xl bg-gradient-to-br from-rose-950/80 to-amber-950/40 border border-rose-700/60 shadow-lg text-left">
      <div className="flex items-start space-x-2.5">
        <div className="p-1.5 rounded-lg bg-rose-900/60 border border-rose-600/40 text-rose-300 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-xs font-semibold text-rose-200">
            Local AI engine is offline. Please start Ollama.
          </h3>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            TabSitter performs all AI summarization and embeddings strictly on your local hardware.
          </p>
          <div className="mt-2 p-2 rounded-md bg-slate-950/90 border border-slate-800 text-[10px] font-mono text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-slate-400" />
              ollama run gemma2
            </span>
          </div>
          <button
            onClick={onRetry}
            disabled={retrying}
            className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-rose-700 hover:bg-rose-600 active:scale-95 text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Checking..." : "Retry Connection"}
          </button>
        </div>
      </div>
    </div>
  );
};

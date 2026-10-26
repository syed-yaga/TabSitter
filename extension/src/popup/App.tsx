import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { OllamaOfflineBanner } from "./components/OllamaOfflineBanner";
import { HammockMode } from "./components/HammockMode";
import { SemanticSearch } from "./components/SemanticSearch";
import { CanopyClusters } from "./components/CanopyClusters";
import { checkOllamaHealth } from "../services/ollama";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"hammock" | "search" | "clusters">("hammock");
  const [ollamaOnline, setOllamaOnline] = useState<boolean>(true);
  const [retryingOllama, setRetryingOllama] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const verifyOllamaStatus = async () => {
    setRetryingOllama(true);
    try {
      const health = await checkOllamaHealth();
      setOllamaOnline(health.online);
    } catch {
      setOllamaOnline(false);
    } finally {
      setRetryingOllama(false);
    }
  };

  useEffect(() => {
    verifyOllamaStatus();
  }, []);

  const handleRefreshClusters = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="w-[440px] min-h-[560px] bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      <Header
        ollamaOnline={ollamaOnline}
        onRefreshHealth={verifyOllamaStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Offline Alert Banner */}
      {!ollamaOnline && (
        <OllamaOfflineBanner
          onRetry={verifyOllamaStatus}
          retrying={retryingOllama}
        />
      )}

      {/* Tab Panels */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "hammock" && (
          <HammockMode
            ollamaOnline={ollamaOnline}
            onOllamaError={() => setOllamaOnline(false)}
            onRefreshClusters={handleRefreshClusters}
          />
        )}

        {activeTab === "search" && (
          <SemanticSearch
            ollamaOnline={ollamaOnline}
            onOllamaError={() => setOllamaOnline(false)}
          />
        )}

        {activeTab === "clusters" && (
          <CanopyClusters onRefreshTrigger={refreshTrigger} />
        )}
      </main>

      {/* Footer info */}
      <footer className="px-4 py-2 border-t border-slate-900 bg-slate-950/80 text-[10px] text-slate-500 flex items-center justify-between">
        <span>TabSitter v1.0 • Hackathon MVP</span>
        <span className="font-mono text-slate-400">gemma2 + nomic-embed</span>
      </footer>
    </div>
  );
};

export default App;

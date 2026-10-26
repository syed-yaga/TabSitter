import React, { useEffect, useState } from "react";
import { Folder, ExternalLink, RefreshCw, Eye, Sparkles } from "lucide-react";
import { ProjectRecord, SavedPageRecord } from "../../types";
import { fetchProjectsBackend, fetchPagesBackend } from "../../services/api";

interface CanopyClustersProps {
  onRefreshTrigger?: number;
}

export const CanopyClusters: React.FC<CanopyClustersProps> = ({ onRefreshTrigger }) => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [orphanPages, setOrphanPages] = useState<SavedPageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadClusters = async () => {
    setLoading(true);
    try {
      const [fetchedProjects, allPages] = await Promise.all([
        fetchProjectsBackend(),
        fetchPagesBackend(),
      ]);
      setProjects(fetchedProjects);

      // Pages without projects
      const unassigned = allPages.filter((p) => !p.projectId);
      setOrphanPages(unassigned);
    } catch (err) {
      console.error("Failed to load clusters:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, [onRefreshTrigger]);

  const openTab = (url: string) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span>Gathering your sleeping canopy...</span>
      </div>
    );
  }

  const hasContent = projects.length > 0 || orphanPages.length > 0;

  if (!hasContent) {
    return (
      <div className="py-16 px-4 text-center text-slate-400 text-xs">
        <Folder className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="font-semibold text-slate-300">Your Canopy is Empty</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Hibernate some tabs with Hammock Mode to organize them into semantic project clusters.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3 max-h-[460px] overflow-y-auto pr-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Canopy Clusters ({projects.length})
        </span>
        <button
          onClick={loadClusters}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      {projects.map((project) => (
        <div
          key={project.id}
          className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 text-left shadow-sm"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
              <h3 className="text-xs font-semibold text-slate-100 truncate">{project.name}</h3>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 shrink-0">
              {project.savedPages?.length || 0} tabs
            </span>
          </div>

          <div className="space-y-1.5 mt-2">
            {(project.savedPages || []).map((page) => (
              <div
                key={page.id}
                className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 transition"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-xs font-medium text-slate-200 line-clamp-1">
                    {page.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {page.status === "reawakened" && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium">
                        Reawakened
                      </span>
                    )}
                    <button
                      onClick={() => openTab(page.url)}
                      title="Reopen tab"
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {page.intent && (
                  <p className="text-[10px] text-amber-300/80 mt-1 line-clamp-1">
                    🎯 {page.intent}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{page.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Unassigned / Loose pages */}
      {orphanPages.length > 0 && (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-3 text-left">
          <h3 className="text-xs font-semibold text-slate-400 mb-2">Unclustered Hibernations</h3>
          <div className="space-y-1.5">
            {orphanPages.map((page) => (
              <div
                key={page.id}
                className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-300 truncate">{page.title}</p>
                  <p className="text-[10px] text-slate-500 truncate">{page.summary}</p>
                </div>
                <button
                  onClick={() => openTab(page.url)}
                  className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

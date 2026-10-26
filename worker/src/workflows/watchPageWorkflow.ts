import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/evaluatePage.js";

const { extractAndEvaluatePage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "15s",
    maximumInterval: "2m",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface WatchPageParams {
  url: string;
  oldSummary: string;
  intent: string;
  savedPageId?: string;
}

/**
 * Temporal Workflow: watchPageWorkflow
 * Orchestrates periodic evaluation of sleeping pages for reawakening.
 * Designed to execute on a Cron schedule (e.g. "0 * * * *") via Temporal Server.
 */
export async function watchPageWorkflow(params: WatchPageParams): Promise<{
  completed: boolean;
  reawakened: boolean;
  reason: string;
}> {
  const result = await extractAndEvaluatePage(
    params.url,
    params.oldSummary,
    params.intent,
    params.savedPageId
  );

  return {
    completed: true,
    reawakened: result.updated,
    reason: result.reason,
  };
}

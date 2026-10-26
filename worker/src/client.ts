import { Connection, Client, ConnectionOptions } from "@temporalio/client";
import { watchPageWorkflow } from "./workflows/watchPageWorkflow.js";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
const namespace = process.env.TEMPORAL_NAMESPACE || "default";
const taskQueue = process.env.TASK_QUEUE || "tabsitter-watch-queue";
const apiKey = process.env.TEMPORAL_API_KEY;
const certPath = process.env.TEMPORAL_CLIENT_CERT_PATH;
const keyPath = process.env.TEMPORAL_CLIENT_KEY_PATH;

const isCloud = temporalAddress.includes(".tmprl.cloud") || !!apiKey || (!!certPath && !!keyPath);

/**
 * Triggers or schedules a watchPageWorkflow on Temporal.
 */
export async function schedulePageWatch(params: {
  url: string;
  oldSummary: string;
  intent: string;
  savedPageId: string;
  cronSchedule?: string; // e.g. "0 * * * *"
}) {
  const connectionOptions: ConnectionOptions = {
    address: temporalAddress,
  };

  if (isCloud) {
    if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      connectionOptions.tls = {
        clientCertPair: {
          crt: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        },
      };
    } else {
      connectionOptions.tls = true;
    }

    if (apiKey) {
      connectionOptions.apiKey = apiKey;
    }
  }

  const connection = await Connection.connect(connectionOptions);
  const client = new Client({ connection, namespace });

  const workflowId = `watch-${params.savedPageId}-${Date.now()}`;
  console.log(`Scheduling Temporal Workflow: ${workflowId}`);

  const handle = await client.workflow.start(watchPageWorkflow, {
    taskQueue,
    workflowId,
    cronSchedule: params.cronSchedule || "0 * * * *", // Runs on cron
    args: [params],
  });

  console.log(`Workflow started successfully! ID: ${handle.workflowId}`);
  return handle;
}

// Standalone execution helper for testing
async function main() {
  const testUrl = process.argv[2] || "https://httpbin.org/status/200";
  const testSummary = "Page indicates service is running normally with HTTP 200.";
  const testIntent = "Wake up if pricing is updated or downtime occurs";
  const testId = "mock-page-123";

  try {
    await schedulePageWatch({
      url: testUrl,
      oldSummary: testSummary,
      intent: testIntent,
      savedPageId: testId,
      cronSchedule: "*/15 * * * *",
    });
  } catch (err: any) {
    console.error("Could not schedule workflow:", err.message);
    if (err.details) console.error("Details:", err.details);
    if (isCloud && !apiKey && !certPath) {
      console.log("\n⚠️ Temporal Cloud detected! Please add TEMPORAL_API_KEY to worker/.env to authenticate.");
      console.log("   Example: TEMPORAL_API_KEY=\"<your-temporal-cloud-api-key>\"");
    } else if (!isCloud) {
      console.log("Ensure 'temporal server start-dev' is running.");
    }
  }
}

if (process.argv[1]?.endsWith("client.ts") || process.argv[1]?.endsWith("client.js")) {
  main();
}

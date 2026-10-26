import { Worker, NativeConnection, NativeConnectionOptions } from "@temporalio/worker";
import * as activities from "./activities/evaluatePage.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runWorker() {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE || "default";
  const taskQueue = process.env.TASK_QUEUE || "tabsitter-watch-queue";
  const apiKey = process.env.TEMPORAL_API_KEY;
  const certPath = process.env.TEMPORAL_CLIENT_CERT_PATH;
  const keyPath = process.env.TEMPORAL_CLIENT_KEY_PATH;

  const isCloud = temporalAddress.includes(".tmprl.cloud") || !!apiKey || (!!certPath && !!keyPath);

  console.log(`🦥 Starting TabSitter Temporal Worker...`);
  console.log(`   Connecting to Temporal Server at: ${temporalAddress}`);
  console.log(`   Namespace: ${namespace}`);
  console.log(`   Task Queue: ${taskQueue}`);
  console.log(`   Mode: ${isCloud ? "Temporal Cloud (TLS/Auth)" : "Local Temporal Dev Server"}`);

  try {
    const connectionOptions: NativeConnectionOptions = {
      address: temporalAddress,
    };

    if (isCloud) {
      if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log("   Auth: mTLS Certificates");
        connectionOptions.tls = {
          clientCertPair: {
            crt: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          },
        };
      } else {
        console.log("   Auth: TLS" + (apiKey ? " with API Key" : " (API Key missing)"));
        connectionOptions.tls = true;
      }

      if (apiKey) {
        connectionOptions.apiKey = apiKey;
      }
    }

    const connection = await NativeConnection.connect(connectionOptions);

    const workflowsPath = path.resolve(__dirname, "./workflows/watchPageWorkflow.js");

    const worker = await Worker.create({
      connection,
      namespace,
      taskQueue,
      workflowsPath,
      activities,
    });

    console.log(`🦥 TabSitter Worker is actively listening for monitoring workflows.`);
    await worker.run();
  } catch (error: any) {
    console.error("Worker failed to start:", error.message);
    if (error.details) {
      console.error("Details:", error.details);
    }
    if (isCloud && !apiKey && !certPath) {
      console.log("\n⚠️ Temporal Cloud detected! Please add TEMPORAL_API_KEY to worker/.env to authenticate.");
      console.log("   Example: TEMPORAL_API_KEY=\"<your-temporal-cloud-api-key>\"");
    } else if (!isCloud) {
      console.log("\n💡 Note: To run local Temporal workflows, ensure the local Temporal dev server is running:");
      console.log("   temporal server start-dev");
    }
  }
}

runWorker().catch((err) => {
  console.error(err);
  process.exit(1);
});

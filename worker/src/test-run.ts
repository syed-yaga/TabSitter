import { extractAndEvaluatePage } from "./activities/evaluatePage.js";

async function runDemo() {
  console.log("=== TabSitter Worker Activity Test ===");

  const sampleUrl = "https://example.com";
  const oldSummary = "Example Domain for illustrative examples in documents.";
  const intent = "Check if domain is reserved or has pricing updates";

  console.log(`Testing URL: ${sampleUrl}`);
  console.log(`Old Summary: ${oldSummary}`);
  console.log(`Intent to detect: ${intent}`);

  const result = await extractAndEvaluatePage({
    url: sampleUrl,
    oldSummary,
    intent,
    savedPageId: "demo-page-id",
  });

  console.log("\n=== Evaluation Result ===");
  console.log(`Updated Detected: ${result.updated ? "YES" : "NO"}`);
  console.log(`AI Explanation: ${result.reason}`);
  console.log(`Sample Content Snippet: ${result.extractedContent}`);
  console.log("======================================");
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

runDemo().catch((err) => {
  console.error("Test execution failed:", err);
});

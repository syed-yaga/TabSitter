import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/index.js";

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Chrome Extension and local testing
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// High payload limit to support arrays of 768-dimensional embeddings
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "TabSitter Cloud API",
    timestamp: new Date().toISOString(),
  });
});

// Mount TabSitter API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

let server: any = null;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    console.log(`🦥 TabSitter API is running on http://localhost:${PORT}`);
    console.log(`🦥 Health check available at http://localhost:${PORT}/api/health`);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, closing server...");
    server?.close(() => {
      process.exit(0);
    });
  });
}

export default app;

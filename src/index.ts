import "dotenv/config";
import express from "express";
import cors from "cors";
import scanRouter from "./routes/scan";
import chatRouter from "./routes/chat";
import feedbackRouter from "./routes/feedback";

// Catch anything that slips through so Render always shows a log line
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
  process.exit(1);
});

console.log("Starting CropCure backend...");
console.log("Node version:", process.version);
console.log("NODE_ENV:", process.env.NODE_ENV ?? "(not set)");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "FATAL: ANTHROPIC_API_KEY is not set.\n" +
    "Add it in the Render dashboard under Environment Variables."
  );
  process.exit(1);
}
console.log("ANTHROPIC_API_KEY: present");

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// CORS — always allow the production app origin; merge in CORS_ORIGIN env var if set
const BASE_ORIGINS = ["https://crop-cure-flow.base44.app", "https://preview--crop-cure-flow.base44.app"];
const rawOrigins = process.env.CORS_ORIGIN ?? "";
const allowedOrigins =
  rawOrigins === "*"
    ? "*"
    : [...BASE_ORIGINS, ...rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)];
console.log("CORS allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Dev-Secret"],
  })
);

app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/scan", scanRouter);
app.use("/api/chat", chatRouter);
app.use("/api/feedback", feedbackRouter);

const server = app.listen(PORT, () => {
  console.log(`CropCure backend running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

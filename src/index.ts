import "dotenv/config";
import express from "express";
import cors from "cors";
import scanRouter from "./routes/scan";
import chatRouter from "./routes/chat";

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

// CORS — comma-separated origins in CORS_ORIGIN, or * for development
const rawOrigins = process.env.CORS_ORIGIN ?? "*";
const allowedOrigins = rawOrigins === "*" ? "*" : rawOrigins.split(",").map((o) => o.trim());
console.log("CORS_ORIGIN:", rawOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "20mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/scan", scanRouter);
app.use("/api/chat", chatRouter);

const server = app.listen(PORT, () => {
  console.log(`CropCure backend running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

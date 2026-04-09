import "dotenv/config";
import express from "express";
import cors from "cors";
import scanRouter from "./routes/scan";
import chatRouter from "./routes/chat";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY is not set. Create a .env file with your key.");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT ?? 3000;

// CORS — comma-separated origins in CORS_ORIGIN, or * for development
const rawOrigins = process.env.CORS_ORIGIN ?? "*";
const allowedOrigins = rawOrigins === "*" ? "*" : rawOrigins.split(",").map((o) => o.trim());

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

app.listen(PORT, () => {
  console.log(`CropCure backend running on http://localhost:${PORT}`);
});

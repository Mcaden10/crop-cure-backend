import { Router, Request, Response } from "express";
import fs from "fs";
import {
  FeedbackEntry,
  FEEDBACK_FILE,
  loadFeedback,
  saveFeedback,
  getTopMisdiagnoses,
} from "../lib/feedbackStore";

const router = Router();

// POST /api/feedback
router.post("/", (req: Request, res: Response): void => {
  const { imageId, predictedDisease, correctDisease, cropType, notes, confidence } =
    req.body as Partial<FeedbackEntry & { confidence: number }>;

  if (!imageId || !predictedDisease || !correctDisease) {
    res.status(400).json({ error: "imageId, predictedDisease, and correctDisease are required." });
    return;
  }

  const entry: FeedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    imageId: String(imageId),
    predictedDisease: String(predictedDisease),
    correctDisease: String(correctDisease),
    cropType: cropType ? String(cropType) : "",
    notes: notes ? String(notes) : "",
    confidence: typeof confidence === "number" ? confidence : null,
    timestamp: new Date().toISOString(),
  };

  const entries = loadFeedback();
  entries.push(entry);
  saveFeedback(entries);

  res.status(201).json({ success: true, id: entry.id });
});

// GET /api/feedback/summary
router.get("/summary", (_req: Request, res: Response): void => {
  const entries = loadFeedback();
  const top = getTopMisdiagnoses(10);

  if (entries.length === 0) {
    res.json({ total: 0, misdiagnoses: [], corrections: [], summary: "No feedback submissions yet." });
    return;
  }

  const corrections = top.map((m) => m.correction);
  const totalMisdiagnoses = top.reduce((sum, m) => sum + m.count, 0);

  const summary =
    corrections.length === 0
      ? `All ${entries.length} submission${entries.length !== 1 ? "s" : ""} were correct diagnoses.`
      : corrections.join("\n");

  res.json({
    total: entries.length,
    totalMisdiagnoses,
    misdiagnoses: top,
    corrections,
    summary,
  });
});

// GET /api/feedback/all  (developer-only)
router.get("/all", requireDevSecret, (_req: Request, res: Response): void => {
  const entries = loadFeedback();
  res.json({ total: entries.length, entries });
});

// DELETE /api/feedback  (developer-only) — clears all feedback
router.delete("/", requireDevSecret, (_req: Request, res: Response): void => {
  try {
    fs.writeFileSync(FEEDBACK_FILE, "[]", "utf-8");
    res.json({ success: true, message: "All feedback entries deleted." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to clear feedback.";
    res.status(500).json({ error: msg });
  }
});

function requireDevSecret(req: Request, res: Response, next: () => void): void {
  const secret = process.env.DEV_SECRET;
  if (!secret) {
    res.status(403).json({ error: "DEV_SECRET is not configured on this server." });
    return;
  }
  const provided = req.headers["x-dev-secret"];
  if (provided !== secret) {
    res.status(403).json({ error: "Invalid or missing X-Dev-Secret header." });
    return;
  }
  next();
}

export default router;

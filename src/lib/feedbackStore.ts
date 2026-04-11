import fs from "fs";
import path from "path";

export const FEEDBACK_FILE = path.resolve(process.cwd(), "data", "feedback.json");

export interface FeedbackEntry {
  id: string;
  imageId: string;
  predictedDisease: string;
  correctDisease: string;
  cropType: string;
  notes: string;
  confidence: number | null;
  timestamp: string;
}

export interface Misdiagnosis {
  predictedDisease: string;
  correctDisease: string;
  cropType: string;
  count: number;
  correction: string;
}

export function loadFeedback(): FeedbackEntry[] {
  try {
    const raw = fs.readFileSync(FEEDBACK_FILE, "utf-8");
    return JSON.parse(raw) as FeedbackEntry[];
  } catch {
    return [];
  }
}

export function saveFeedback(entries: FeedbackEntry[]): void {
  fs.mkdirSync(path.dirname(FEEDBACK_FILE), { recursive: true });
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

/**
 * Returns the top `limit` misdiagnosis triples (predictedDisease, cropType, correctDisease)
 * sorted by frequency, with a human-readable correction string for each.
 */
export function getTopMisdiagnoses(limit = 10): Misdiagnosis[] {
  const entries = loadFeedback();

  const counts = new Map<string, Misdiagnosis>();
  for (const e of entries) {
    if (e.predictedDisease.toLowerCase() === e.correctDisease.toLowerCase()) continue;
    const key = `${e.predictedDisease}|||${e.cropType}|||${e.correctDisease}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      const cropLabel = e.cropType ? ` on ${e.cropType}` : "";
      counts.set(key, {
        predictedDisease: e.predictedDisease,
        correctDisease: e.correctDisease,
        cropType: e.cropType,
        count: 1,
        correction: `CORRECTION: When you diagnose ${e.predictedDisease}${cropLabel}, double check - it may actually be ${e.correctDisease}.`,
      });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { getTopMisdiagnoses } from "../lib/feedbackStore";

const router = Router();
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof VALID_MEDIA_TYPES)[number];

const SYSTEM_PROMPT = `You are an expert plant pathologist and agricultural scientist.
Analyze crop photos for diseases, pests, or nutrient deficiencies.
Always respond with valid JSON only — no markdown, no explanation outside the JSON object.

When diagnosing mildew, carefully distinguish between the two types:
- Powdery mildew: white or grey powdery/dusty coating that appears ON TOP of (upper surface of) leaves. The powder can often be rubbed off. Affects the upper leaf surface primarily.
- Downy mildew: yellow or pale green patches visible on the UPPER leaf surface, with grey, purple, or brown fuzzy/downy growth visible UNDERNEATH the leaf (lower surface). The fuzz is the sporangia growing on the underside.
Before diagnosing either mildew type, determine which surface the growth is on and note the color and texture. If the image only shows one side of the leaf, consider whether the visible symptoms match the upper-surface or lower-surface pattern for each type.`;

const USER_PROMPT = `Analyze this crop photo and identify any disease, pest damage, or nutrient deficiency present.

Respond with this exact JSON structure:
{
  "disease": "name of the disease, pest, or condition (or 'Healthy' if no issues found)",
  "confidence": <number between 0 and 1>,
  "severity": "none" | "low" | "medium" | "high" | "critical",
  "affectedParts": ["list", "of", "affected", "plant", "parts"],
  "treatment": ["step 1", "step 2", "..."],
  "prevention": ["advice 1", "advice 2", "..."],
  "needs_better_photo": <true if confidence is below 0.60, otherwise false>,
  "photo_instructions": "specific guidance on what angle, surface, or lighting would help — e.g. 'Photograph the underside of the leaf to check for fuzzy growth' or 'Take the photo in natural daylight with the affected area filling the frame'. Empty string if needs_better_photo is false.",
  "possible_diseases": ["top 2-3 candidate disease names when unsure, otherwise empty array"]
}

Rules:
- confidence reflects how certain you are of the diagnosis
- severity is "none" only when the plant is healthy
- treatment and prevention must each have at least one item
- needs_better_photo must be true whenever confidence < 0.60
- photo_instructions must be a non-empty, specific string whenever needs_better_photo is true; tailor it to the suspected disease (e.g. ask for the leaf underside for mildew, close-up of lesion edges for blights, new growth for nutrient deficiencies)
- possible_diseases should list 2-3 candidate names when needs_better_photo is true; empty array when confident
- respond with raw JSON only, no code fences`;

interface ScanRequest {
  image: string;
  mediaType?: string;
}

interface ScanResult {
  disease: string;
  confidence: number;
  severity: "none" | "low" | "medium" | "high" | "critical";
  affectedParts: string[];
  treatment: string[];
  prevention: string[];
  needs_better_photo: boolean;
  photo_instructions: string;
  possible_diseases: string[];
}

function buildSystemPrompt(): string {
  const corrections = getTopMisdiagnoses(10);
  if (corrections.length === 0) return SYSTEM_PROMPT;
  const correctionBlock = corrections.map((m) => m.correction).join("\n");
  return `${SYSTEM_PROMPT}\n\nPast user corrections — pay special attention to these known misdiagnoses:\n${correctionBlock}`;
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { image, mediaType = "image/jpeg" } = req.body as ScanRequest;

  if (!image || typeof image !== "string") {
    res.status(400).json({ error: "Request body must include an 'image' field with a base64-encoded string." });
    return;
  }

  if (!VALID_MEDIA_TYPES.includes(mediaType as ImageMediaType)) {
    res.status(400).json({ error: `Invalid mediaType. Must be one of: ${VALID_MEDIA_TYPES.join(", ")}` });
    return;
  }

  // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
  const base64Data = image.replace(/^data:[^;]+;base64,/, "");

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as ImageMediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: USER_PROMPT,
            },
          ],
        },
      ],
    });

    const raw = message.content[0];
    if (raw.type !== "text") {
      res.status(502).json({ error: "Unexpected response format from Claude." });
      return;
    }

    let result: ScanResult;
    try {
      result = JSON.parse(raw.text) as ScanResult;
    } catch {
      res.status(502).json({ error: "Claude returned non-JSON output.", raw: raw.text });
      return;
    }

    res.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      res.status(err.status ?? 502).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Scan failed";
    res.status(500).json({ error: message });
  }
});

export default router;

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert agronomist and farming assistant with deep knowledge across:
- Crop diseases, pest management, and integrated pest control
- Soil health, fertilisation, and nutrient management
- Irrigation, water management, and drought strategies
- Seasonal planting calendars and crop rotation planning
- Organic and conventional farming practices
- Post-harvest handling and storage

Give practical, actionable advice tailored to the farmer's situation.
Keep responses concise and easy to follow. Use numbered steps or bullet points when listing instructions.
If the question is outside farming and agriculture, politely redirect the conversation back to farming topics.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages?: ChatMessage[];
  message: string;
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const { messages = [], message } = req.body as ChatRequest;

  if (!message || typeof message !== "string" || message.trim() === "") {
    res.status(400).json({ error: "Request body must include a non-empty 'message' string." });
    return;
  }

  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "'messages' must be an array." });
    return;
  }

  // Validate history shape
  for (const msg of messages) {
    if (msg.role !== "user" && msg.role !== "assistant") {
      res.status(400).json({ error: "Each message in 'messages' must have role 'user' or 'assistant'." });
      return;
    }
    if (typeof msg.content !== "string") {
      res.status(400).json({ error: "Each message in 'messages' must have a string 'content' field." });
      return;
    }
  }

  const fullMessages: Anthropic.MessageParam[] = [
    ...messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message.trim() },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: fullMessages,
    });

    const block = response.content[0];
    if (block.type !== "text") {
      res.status(502).json({ error: "Unexpected response format from Claude." });
      return;
    }

    res.json({ response: block.text });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      res.status(err.status ?? 502).json({ error: err.message });
      return;
    }
    const msg = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ error: msg });
  }
});

export default router;

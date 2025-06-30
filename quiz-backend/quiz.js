import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// ✅ Add your OpenRouter API key directly here for testing (remove this in production)
const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || "sk-your-api-key-here"; // ← Insert your real key here temporarily

app.use(
  cors({
    origin: [
      "https://quiz-nova-zeta.vercel.app",
      "https://quiz-nova-eyh47gwct-yagnarashagans-projects-5a973c49.vercel.app",
      "http://localhost:3000",
    ],
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.post("/api/generate-quiz", async (req, res) => {
  const { topic, count } = req.body;

  console.log("📩 Request received for topic:", topic, "Count:", count);

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Missing OpenRouter API key." });
  }

  const prompt = `Generate exactly ${count} multiple choice quiz questions on the topic "${topic}". Each question must strictly follow this format:
- A question text
- Four options prefixed with "A)", "B)", "C)", "D)"
- One correctAnswer matching an option
Return ONLY valid JSON like:
[
  {
    "text": "Sample?",
    "options": ["A) A", "B) B", "C) C", "D) D"],
    "correctAnswer": "B) B"
  }
]`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://quiz-nova-zeta.vercel.app",
          "X-Title": "QuizNova",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-0528-qwen3-8b:free",
          messages: [
            {
              role: "system",
              content:
                "You are a strict quiz generator that replies only in JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.5,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ OpenRouter API Error:", text);
      return res
        .status(500)
        .json({ error: "OpenRouter API error", details: text });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return res
        .status(500)
        .json({ error: "No content received from AI.", raw: data });
    }

    // Clean content from backticks if needed
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```[a-zA-Z]*\n/, "")
        .replace(/```$/, "")
        .trim();
    }

    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1) {
      return res
        .status(500)
        .json({ error: "Invalid JSON format", raw: cleaned });
    }

    const jsonString = cleaned.substring(firstBracket, lastBracket + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Failed to parse JSON", raw: jsonString });
    }

    // Validate & transform
    const transformed = parsed.map((q, i) => {
      const { text, options, correctAnswer } = q;
      if (!text || !options || options.length !== 4 || !correctAnswer) {
        throw new Error(`Invalid question ${i + 1}`);
      }

      const formattedOptions = options.map((opt, i) => {
        const prefix = `${String.fromCharCode(65 + i)}) `;
        return opt.startsWith(prefix) ? opt : `${prefix}${opt}`;
      });

      if (!formattedOptions.includes(correctAnswer)) {
        throw new Error(`Correct answer mismatch in question ${i + 1}`);
      }

      return {
        text,
        options: formattedOptions,
        correctAnswer,
      };
    });

    res.json({ questions: transformed });
  } catch (err) {
    console.error("🔥 Backend Error:", err);
    res
      .status(500)
      .json({ error: "Quiz generation failed", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ QuizNova backend running on port ${PORT}`);
});

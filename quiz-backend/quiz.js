import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.post("/api/generate-quiz", async (req, res) => {
  const { topic, count } = req.body;

  const prompt = `Generate exactly ${count} multiple choice quiz questions on the topic "${topic}". Each question must strictly follow this format:
- A question text (clear, concise, and relevant to the topic)
- Exactly four options, each prefixed with "A)", "B)", "C)", or "D)" (e.g., "A) Option 1")
- One correct answer as the full option text, including the letter prefix (e.g., "B) Option 2")
- Ensure options are unique and the correct answer matches one of the options exactly
Return the response in valid JSON format, with no additional text or code block markers, like this:
[
  {
    "text": "Sample question?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correctAnswer": "B) Option 2"
  }
]
Do not include code block markers (e.g., \`\`\`), comments, or any text outside the JSON array. Ensure all options have the correct prefix and the correctAnswer is the full text of one option.`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "EduGen AI",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-r1-0528-qwen3-8b:free",
          messages: [
            {
              role: "system",
              content:
                "You are an educational quiz generator that strictly follows the provided JSON format.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.5, // Lower temperature for stricter adherence
        }),
      }
    );

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let cleaned = content.trim();
    // Remove code block markers if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```[a-zA-Z]*\n/, "")
        .replace(/```$/, "")
        .trim();
    }
    // Extract the first JSON array
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket === -1) {
      console.error("Invalid JSON structure:", cleaned);
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON structure", raw: cleaned });
    }
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", cleaned);
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON", raw: cleaned });
    }

    // Validate and transform the response
    const transformedQuestions = parsed.map((question, index) => {
      const { text, options, correctAnswer } = question;
      if (!text || !options || options.length !== 4 || !correctAnswer) {
        console.error(`Invalid question ${index + 1}:`, question);
        throw new Error(
          `Question ${
            index + 1
          } is missing required fields or has incorrect option count`
        );
      }

      // Ensure options have prefixes and are unique
      const prefixedOptions = options.map((opt, i) => {
        const prefix = `${String.fromCharCode(65 + i)}) `;
        return opt.startsWith(prefix) ? opt : `${prefix}${opt.trim()}`;
      });
      const uniqueOptions = [...new Set(prefixedOptions)];
      if (uniqueOptions.length !== 4) {
        console.error(`Duplicate options in question ${index + 1}:`, options);
        throw new Error(`Question ${index + 1} has duplicate options`);
      }

      // Ensure correctAnswer is the full option text
      let fullCorrectAnswer = correctAnswer;
      if (correctAnswer.length === 1 && /[A-D]/.test(correctAnswer)) {
        const index = correctAnswer.charCodeAt(0) - 65; // A->0, B->1, etc.
        fullCorrectAnswer = prefixedOptions[index] || correctAnswer;
      }
      if (!prefixedOptions.includes(fullCorrectAnswer)) {
        console.error(
          `Invalid correctAnswer in question ${index + 1}:`,
          correctAnswer
        );
        throw new Error(
          `Correct answer "${correctAnswer}" does not match any option in question ${
            index + 1
          }`
        );
      }

      return {
        text,
        options: prefixedOptions,
        correctAnswer: fullCorrectAnswer,
      };
    });

    res.json({ questions: transformedQuestions });
  } catch (err) {
    console.error("Quiz generation error:", err.message);
    res
      .status(500)
      .json({ error: "Failed to generate quiz", message: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

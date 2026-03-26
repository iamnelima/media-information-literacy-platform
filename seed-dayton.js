require("dotenv").config();
const mysql = require("mysql2/promise");
const crypto = require("crypto");
const { GoogleGenAI, Type } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌  GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

const db = mysql.createPool({
  host: process.env.HOST || "localhost",
  user: process.env.USER || "root",
  password: process.env.PASSWORD || "",
  database: process.env.DATABASE || "miles_school",
});

const ai = new GoogleGenAI({});

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    credibilityScore: { type: Type.INTEGER },
    verdict_label: { type: Type.STRING },
    verdict_color: { type: Type.STRING },
    explanation: { type: Type.STRING },
    date_of_check: { type: Type.STRING },
    sector: { type: Type.STRING },
  },
};

const credibilityPrompt = `
You are a fact-checking agent for MILES. Given this news article, evaluate its credibility.
Rules:
- credibilityScore: 0-100
- verdict_label: "Highly Credible" (>=70) | "Somewhat Credible" (60-69) | "Low Credibility" (50-59) | "Not Credible" (<50)
- verdict_color: "green" | "yellow" | "orange" | "red" (matching the label)
- explanation: 1-3 sentence summary of your reasoning
- date_of_check: today's date YYYY-MM-DD
- sector: Entertainment or General

News Article:
`;

function generateHash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function main() {
  const text = "Dayton Webber, a quadruple amputee, inspires millions with his wrestling and skateboarding achievements. Despite losing all four limbs to a life-threatening bacterial infection as a baby, Webber has defied all odds to compete in competitive wrestling and become a well-known figure in the adaptive sports community.";
  
  const hash = generateHash(text);
  const postId = hash.substring(33, 63);
  const author = "miles_news_bot";

  console.log("Evaluating Dayton Webber story...");
  let aiResult;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: credibilityPrompt + text,
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });
    aiResult = JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini failed:", error);
    process.exit(1);
  }

  try {
    const [existing] = await db.query("SELECT post_id FROM posts WHERE post_id = ?", [postId]);
    if (existing.length > 0) {
      console.log("Post already exists!");
      process.exit(0);
    }

    await db.query(
      "INSERT INTO posts(post_id, author, image_location, text_content, credibility_score, date_of_check, verdict_label, verdict_color, ai_analysis, sector) VALUES(?,?,?,?,?,?,?,?,?,?)",
      [
        postId,
        author,
        null, // No image for now to keep it simple
        text,
        aiResult.credibilityScore,
        aiResult.date_of_check,
        aiResult.verdict_label,
        aiResult.verdict_color,
        aiResult.explanation,
        "General", // Sector
      ]
    );
    console.log("✅ Successfully inserted Dayton Webber news story into the database!");
  } catch (dbErr) {
    console.error("Database error:", dbErr);
  }
  
  await db.end();
  process.exit(0);
}

main();

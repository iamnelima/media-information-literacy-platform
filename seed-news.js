/**
 * MILES News Seeder
 * ==================
 * Fetches real news articles from NewsAPI.org,
 * downloads their images, runs Gemini AI credibility
 * analysis, and inserts them into the MILES database.
 *
 * Usage: node seed-news.js
 * Run once from the project root after starting MySQL.
 */

require("dotenv").config();
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { GoogleGenAI, Type } = require("@google/genai");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!NEWS_API_KEY) {
  console.error("❌  NEWS_API_KEY is missing in .env");
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error("❌  GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

// ───── DB connection ─────────────────────────────────────────────────────────
const db = mysql.createPool({
  host: process.env.HOST || "localhost",
  user: process.env.USER || "root",
  password: process.env.PASSWORD || "",
  database: process.env.DATABASE || "miles_school",
});

// ───── Gemini ────────────────────────────────────────────────────────────────
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
You are a fact-checking agent for MILES (Media & Information Literacy Engagement System).
Given a news article headline and description, evaluate its credibility.

Rules:
- credibilityScore: 0–100
- verdict_label: "Highly Credible" (>=70) | "Somewhat Credible" (60-69) | "Low Credibility" (50-59) | "Not Credible" (<50)
- verdict_color: "green" | "yellow" | "orange" | "red" (matching the label)
- explanation: 1–3 sentence summary of your reasoning
- date_of_check: today's date YYYY-MM-DD format
- sector: One of Politics | Health | Tech | Agriculture | Entertainment | Business | Science | General

News Article:
`;

// ───── Helpers ───────────────────────────────────────────────────────────────
function generateHash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    const request = protocol.get(url, { timeout: 10000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // follow redirect
        file.close();
        fs.unlink(destPath, () => {});
        return downloadImage(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    });
    request.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
    request.on("timeout", () => {
      request.destroy();
      file.close();
      fs.unlink(destPath, () => {});
      reject(new Error("Request timed out"));
    });
  });
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        "User-Agent": "MILES-News-Seeder/1.0 (media-information-literacy-platform)",
        "Accept": "application/json",
      },
    };
    https
      .get(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}


// ───── Sector → NewsAPI category mapping ────────────────────────────────────
const SECTOR_MAP = [
  { sector: "Politics", category: "politics", count: 5 },
  { sector: "Health", category: "health", count: 5 },
  { sector: "Tech", category: "technology", count: 5 },
  { sector: "Business", category: "business", count: 3 },
  { sector: "Science", category: "science", count: 3 },
  { sector: "Entertainment", category: "entertainment", count: 2 },
];

// ───── Main seeder ───────────────────────────────────────────────────────────
async function seedSector({ sector, category, count }) {
  const url = `https://newsapi.org/v2/top-headlines?category=${category}&language=en&pageSize=${count}&apiKey=${NEWS_API_KEY}`;
  console.log(`\n📥  Fetching ${count} ${sector} articles…`);

  let data;
  try {
    data = await fetchJSON(url);
  } catch (e) {
    console.error(`   ⚠️  Could not fetch ${sector}: ${e.message}`);
    return;
  }

  if (data.status !== "ok" || !data.articles) {
    console.error(`   ⚠️  NewsAPI error for ${sector}: ${JSON.stringify(data)}`);
    return;
  }

  const articles = data.articles.filter(
    (a) => a.title && a.title !== "[Removed]" && a.description
  );

  for (const article of articles) {
    const text = `${article.title}\n\n${article.description || ""}`;
    const hash = generateHash(text);
    const postId = hash.substring(33, 63);
    const shortHash = hash.substring(43, 63);
    const author = "miles_news_bot";

    // ── Skip if already exists ──
    const [existing] = await db.query(
      "SELECT post_id FROM posts WHERE post_id = ?",
      [postId]
    );
    if (existing.length > 0) {
      console.log(`   ⏭️  Already exists, skipping: ${article.title.slice(0, 60)}`);
      continue;
    }

    // ── Download image ──
    let dbImagePath = null;
    if (article.urlToImage) {
      try {
        const imageUrl = article.urlToImage;
        const ext = imageUrl.split("?")[0].split(".").pop().split("/").pop() || "jpg";
        const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext.toLowerCase())
          ? ext.toLowerCase()
          : "jpg";
        const fileName = `${shortHash}.${safeExt}`;
        const destPath = path.join(__dirname, "public", "posts", fileName);
        await downloadImage(imageUrl, destPath);
        dbImagePath = `posts/${fileName}`;
        console.log(`   🖼️  Image saved: ${fileName}`);
      } catch (imgErr) {
        console.warn(`   ⚠️  Image download failed: ${imgErr.message}`);
      }
    }

    // ── Gemini credibility analysis ──
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
    } catch (aiErr) {
      console.warn(`   ⚠️  Gemini error: ${aiErr.message} — using defaults`);
      aiResult = {
        credibilityScore: 65,
        verdict_label: "Somewhat Credible",
        verdict_color: "yellow",
        explanation: "Credibility could not be fully assessed at this time.",
        date_of_check: new Date().toISOString().split("T")[0],
        sector,
      };
    }

    // Use the forced sector (from SECTOR_MAP) rather than AI's guess
    const finalSector = sector;

    // ── Insert into DB ──
    try {
      await db.query(
        "INSERT INTO posts(post_id, author, image_location, text_content, credibility_score, date_of_check, verdict_label, verdict_color, ai_analysis, sector) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
          postId,
          author,
          dbImagePath,
          text,
          aiResult.credibilityScore,
          aiResult.date_of_check,
          aiResult.verdict_label,
          aiResult.verdict_color,
          aiResult.explanation,
          finalSector,
        ]
      );
      console.log(`   ✅  Inserted [${finalSector}]: ${article.title.slice(0, 70)}`);
    } catch (dbErr) {
      if (dbErr.code === "ER_DUP_ENTRY") {
        console.log(`   ⏭️  Duplicate post_id, skipping.`);
      } else {
        console.error(`   ❌  DB error: ${dbErr.message}`);
      }
    }

    // Small delay to avoid hammering Gemini rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function main() {
  console.log("🌍  MILES News Seeder starting…");
  console.log("   Database:", process.env.DATABASE);
  console.log("   NewsAPI Key:", NEWS_API_KEY.slice(0, 8) + "…");

  for (const sectorConfig of SECTOR_MAP) {
    await seedSector(sectorConfig);
  }

  console.log("\n🎉  Seeding complete! Refresh your MILES feed to see the articles.");
  await db.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

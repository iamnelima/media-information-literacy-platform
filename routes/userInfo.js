const express = require("express");
require("dotenv").config();
const { GoogleGenAI, Type } = require("@google/genai");
const Groq = require("groq-sdk");
const router = express.Router();
const connectionPromise = require("./connection.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crpto = require("crypto");
const ws = require("ws");
let verificationColumnsEnsured = false;

function ensureUploadDirectories() {
  fs.mkdirSync(path.join(__dirname, "../eval", "images"), { recursive: true });
  fs.mkdirSync(path.join(__dirname, "../public", "posts"), { recursive: true });
}

function getGeminiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "")
    .replace(/^"|"$/g, "")
    .trim();

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Add a valid Gemini API key to the .env file."
    );
  }

  return new GoogleGenAI({ apiKey });
}

function getGroqClient() {
  const apiKey = (process.env.GROQ_API_KEY || "")
    .replace(/^"|"$/g, "")
    .trim();

  if (!apiKey) {
    throw new Error(
      "Missing GROQ_API_KEY. Add a valid Groq API key to the .env file."
    );
  }

  return new Groq({ apiKey });
}

const storage = multer.diskStorage({
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 Megabytes in bytes
    files: 5, // Max 5 files
    fieldSize: 10 * 1024 * 1024,
  },
  destination: (req, file, cb) => {
    ensureUploadDirectories();
    cb(null, path.join(__dirname, "../eval", "images"));
  },
  filename: (req, file, cb) => {
    async function assignName(r) {
      try {
        let request = await r;
        let content = request.body.content;
        let contentHash = generateHash(content);
        contentHash = contentHash.substring(43, 63);
        let ext = file.mimetype.split("/")[1];
        let name = contentHash;
        return cb(null, name + "." + ext);
      } catch (e) {
        console.error("Error while naming file: " + e.code + "\n" + e);
        return JSON.stringify({
          message: "Error occured while uploading image, please try again",
          color: "orange",
        });
      }
    }
    assignName(req);
  },
});
const upload = multer({ storage });

//Prompt for image evaluation
const imageEvalPrompt =
  "System Role:" +
  "You are an AI moderation agent for MILES (Media & Information Literacy Engagement System). Your task is to analyze uploaded images and decide if they follow community guidelines." +
  "Guideline Focus:" +
  " Inappropriate images are not allowed. This includes but is not limited to:" +
  "Nudity (full or partial exposure of private body parts)." +
  "Sexually explicit or suggestive content." +
  "Pornography or sexual acts." +
  "Graphic violence, gore, or disturbing imagery." +
  "Hate symbols, racist or discriminatory imagery." +
  "Content that promotes illegal activity (drugs, weapons, terrorism)." +
  "Appropriate images include:" +
  "Normal social content (memes, screenshots, posts, everyday photos)." +
  "Content used for news, commentary, or discussion that does not violate the rules above." +
  "Your Task:" +
  "Carefully analyze the uploaded image." +
  "Return a JAVASCRIPT OBJECT response with: " +
  'decision: "APPROVED" or "DECLINED".' +
  "reason: A short explanation for the decision." +
  "confidence: A percentage score (0–100) of how confident you are." +
  'Always be strict when detecting nudity or inappropriacy. If unsure, lean toward "DECLINED".' +
  'If the image is declined, suggest a general reason (e.g., "Contains nudity", "Hate symbol detected").';

//Prompt for credibility check
var credibilityPrompt = `

You are an evidence-first fact-checking agent for **MILES (Media & Information Literacy Engagement System)**. Your job: given **information in text** (required) and an **optional image**, evaluate how credible the information is by cross-referencing multiple reputable sources and public fact-check databases. Be transparent, conservative with uncertainty, and produce a machine-readable JSON result.

**PRINCIPLES:**

* Decompose complex content into *atomic claims* and evaluate each separately.
* Prefer **primary sources** (official documents, research papers, government releases), then high-quality journalism and established fact-check organizations.
* If you have web access, perform live searches (see *Sources to query*). If you do **not** have web access, explicitly state that limitation, provide best-effort reasoning from your knowledge base, and mark confidence accordingly.
* If evidence is mixed or missing, say so — **do not** invent facts. When unsure, lean toward DECLINED for claims presented as facts.
* Limit verbatim quotes from external sources to less than 25 words. Include links and short snippet context.

**INPUT:**

* text: (string) — the claim or description (required).
* image: — optional. If provided, analyze visually and cross-check with text.

**SOURCES TO QUERY (in order of priority):**

1. Official/primary documents: government sites, press releases, original studies (PubMed, official gov domains).
2. Reputable fact-check organizations: PolitiFact, Snopes, Africa Check, FullFact, FactCheck.org, Reuters Fact Check, AP Fact Check, Poynter.
3. High-quality news outlets: Reuters, AP, BBC, The New York Times, Guardian, Al Jazeera.
4. Academic sources: PubMed, Google Scholar, arXiv (for scientific/health claims).
5. Domain-specific authoritative sites (WHO, CDC for health; IMF/World Bank for economics).
6. Social posts: only as leads (useful for provenance), not as final evidence.

> If web access is available, search each of the above and return the most relevant results. If you reference any source, include a URL.

**IMAGE ANALYSIS (if image provided):**

* Run visual analysis: identify faces, nudity, manipulations, text in image (OCR).
* Run a reverse-image search (or simulated reverse-image lookup) to find prior uses, original upload times, and mismatched captions.
* For manipulation detection, list visible signs (e.g., inconsistent lighting/shadows, cloned regions, resampling artifacts).
* Cross-check image metadata (EXIF) if available: capture date, device, geolocation. Include any discrepancies with the claim’s stated timeline/location.

**CLAIM DECOMPOSITION:**

* If the input text contains more than one factual assertion, split into numbered atomic data. Evaluate each atomic piece of data individually and then combine evidence for an overall credibility score.

**EVIDENCE ASSESSMENT RULES:**

* Prefer contemporaneous primary evidence over secondary reporting.
* Treat fact-check org verdicts as high-weight evidence; extract the ruling and URL.
* Rate each source for reliability (e.g., reliability: high|medium|low) and use it to weight the final score.
* If sources disagree, summarize the nature of disagreement and how many high-reliability sources support vs contradict.

**SCORING & VERDICTS:**

* Return credibility_score: integer 0–100. Map to labels/colors (use these exact thresholds):

  * >= 70 → "Highly Credible" (green)
  * 60–69 → "Somewhat Credible" (yellow)
  * 50–59 → "Low Credibility" (orange)
  * < 50 → "Not Credible" (red)
* Compute credibility_score by combining: claim-level evidence weights, source reliabilities, recency, and image manipulation likelihood (if image relevant). Document the weighting formula briefly.

**OUTPUT FORMAT (JAVASCRIPT OBJECT):**

Produce **valid JSON** that matches this schema exactly.


**POST-PROCESSING RULES:**

* Include supporting sources and contradicting sources (prioritize highest reliability).
* When quoting, keep quotes less than 25 words.
* If you cannot find any reliable sources, set claim_verdict to Insufficient Evidence and claim_score to a conservative low value (e.g., 20–40) with clear rationale.
* Always include date_of_check and request missing context if that drastically affects credibility (but still produce a best-effort judgment).
* Carefully categorize the post into a \`sector\` from these options: Politics, Health, Tech, Agriculture, Entertainment, General.
* **CONTENT GUARDRAILS:** If the user's post is a personal lifestyle update (e.g., "It's my birthday", "I ate pizza"), spam, or completely irrelevant chatter that is not a public claim/news, YOU MUST REJECT IT. Set \`verdict_label\` to EXACTLY "REJECTED_PERSONAL", set \`credibilityScore\` to 0, and \`verdict_color\` to "red". Celebrity news (e.g., "Rihanna's house was shot at") IS considered valid public news and should be allowed (usually categorized as Entertainment).

**EXAMPLE:**

{
    "credibility_score": 85,
    "verdict_label": "Highly Credible",
    "verdict_color": "green",
    "explanation": "Multiple primary sources and a fact-check confirm this; no contradictory evidence found.",
    "sector": "Politics",
    "date_of_check": "2024-05-20"
}

Here is the content:

`;

const milesPersona = `

You are MILES (Media & Information Literacy Engagement System), an AI tutor whose mission is to help users become smarter consumers and producers of information.

## Persona:
- Tone: Friendly, clear, engaging, supportive (never condescending).
- Style: Conversational, like a knowledgeable mentor who explains things simply with real-world examples.
- Approach: Evidence-based, practical, and neutral. Encourage critical thinking, not blind acceptance.
- Role: A guide who explains concepts, provides examples, asks reflective questions, and suggests practical tools or steps.
- Constraints: Always avoid political bias, stereotypes, or judgmental language.

## Core Objectives:
1. **Educate on Media & Information Literacy (MIL):**
   - Teach users how to evaluate credibility of information, sources, and media.
   - Explain fact-checking methods, source reliability, bias detection, misinformation/disinformation tactics.
   - Provide case studies and simple frameworks (e.g., SIFT, CRAAP test).
   - Introduce fact-checking tools and reliable databases.

2. **Interactive Tutoring:**
   - Answer user questions clearly with structured explanations.
   - Where useful, provide step-by-step guides or checklists.
   - Ask reflective questions to engage the user (“What do you think?” “Have you seen this before?”).
   - Adapt difficulty: If a beginner, explain simply; if advanced, dive deeper.

3. **Fact-Checking Assistant (Optional Mode):**
   - If a user shares text or claims, walk them through how to evaluate it.
   - Give examples of how to cross-check sources and spot red flags.
   - Do not just state “true” or “false”—explain reasoning.

4. **Gamification & Engagement:**
   - Use simple challenges, quizzes, or scenario-based questions (e.g., “Spot the fake headline”).
   - Reward curiosity with encouragement, credibility tips, or badges (conceptually).
   - Use color-coded trust language when evaluating credibility (green, yellow, orange, red).

## Guidelines:
- Always explain **why** information is credible or not, not just the conclusion.
- Encourage curiosity and skepticism in a healthy way.
- Use simple analogies or real-world scenarios where possible.
- Keep answers concise but expandable (short summary + option for more detail).
- If you don’t know or evidence is weak, admit uncertainty and suggest where the user can check.

## Output Format:
- Conversational response to the user’s input.
- Where relevant, include:
  - ✅ Key takeaway (1–2 sentence summary)
  - 📌 Practical tip (user can apply immediately)
  - 💡 Example (optional, if it helps understanding)
- When explaining frameworks or steps, use clear bullet points or numbered lists.

Remember: You are not just answering questions—you are shaping better media & information literacy habits. Your goal is to leave the user a little wiser after every interaction.
KEEP YOUR RESPONSES SHORT AND CONSICE.
Here is the conversation:
`;

const responseStructure = {
  type: Type.OBJECT,
  properties: {
    credibilityScore: {
      type: Type.INTEGER,
      description: "Overall credibility score from 0 to 100",
    },
    verdict_label: {
      type: Type.STRING,
      description:
        'greather or equal to 70 = "Highly Credible" (green), 60 to 69 = "Somewhat Credible" (yellow), 50 to 59 = "Low Credibility" (orange), less than 50 = "Not Credible" (red). If it is a personal/spam post, use EXACTLY "REJECTED_PERSONAL".',
    },
    verdict_color: {
      type: Type.STRING,
      description:
        'greather or equal to 70 = "Highly Credible" (green), 60 to 69 = "Somewhat Credible" (yellow), 50 to 59 = "Low Credibility" (orange), less than 50 = "Not Credible" (red). If rejected, use "red".',
    },
    explanation: {
      type: Type.STRING,
      description: "Detailed summary and rationale for the final verdict.",
    },
    date_of_check: {
      type: Type.STRING,
      description: "The date the check was performed (YYYY-MM-DD).",
    },
    sector: {
      type: Type.STRING,
      description: "The topic or sector this post belongs to, e.g., Politics, Health, Tech, Agriculture, Entertainment, or General.",
    },
  },
};

const evidenceVerificationPrompt = `
You are the evidence-based verification engine for MILES (Media & Information Literacy Engagement System).

Your job:
- Evaluate the credibility of the submitted text and optional image.
- Break the submission into concrete factual claims.
- Use grounded external evidence when available.
- Be conservative: if evidence is weak, mixed, or missing, say that clearly.
- Never invent source URLs, publications, or facts.

Scoring rules:
- 70 to 100 = Highly Credible, green
- 60 to 69 = Somewhat Credible, yellow
- 50 to 59 = Low Credibility, orange
- Below 50 = Not Credible, red

Return valid JSON only. Keep explanations concise and evidence-based.

For key_claims:
- Extract up to 3 important factual claims.
- assessment must be one of: supported, mixed, weak, contradicted, unverified
- confidence must be one of: high, medium, low

Categorize the post into a sector:
- sector must be one of: Politics, Health, Tech, Agriculture, Entertainment, General.

If the user's post is a personal lifestyle update (e.g., "It's my birthday"), spam, or irrelevant chatter, you MUST REJECT IT.
- Set verdict_label to "REJECTED_PERSONAL" and credibilityScore to 0.

For supporting_evidence and contradicting_evidence:
- Write short evidence summaries, not source titles.
- Limit each list to at most 3 items.

For recommended_checks:
- Give practical follow-up checks a user can do next.
- Limit to at most 3 items.

Here is the content to verify:
`;

const evidenceResponseStructure = {
  type: Type.OBJECT,
  properties: {
    credibilityScore: {
      type: Type.INTEGER,
      description: "Overall credibility score from 0 to 100",
    },
    verdict_label: {
      type: Type.STRING,
    },
    verdict_color: {
      type: Type.STRING,
    },
    explanation: {
      type: Type.STRING,
    },
    date_of_check: {
      type: Type.STRING,
    },
    verification_methodology: {
      type: Type.STRING,
    },
    key_claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claim: {
            type: Type.STRING,
          },
          assessment: {
            type: Type.STRING,
          },
          confidence: {
            type: Type.STRING,
          },
          rationale: {
            type: Type.STRING,
          },
        },
      },
    },
    supporting_evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
    contradicting_evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
    recommended_checks: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
    },
    sector: {
      type: Type.STRING,
      description: "The topic or sector this post belongs to, e.g., Politics, Health, Tech, Agriculture, Entertainment, or General.",
    },
  },
};

function inferVerdictColor(score) {
  if (score >= 70) {
    return "green";
  }
  if (score >= 60) {
    return "yellow";
  }
  if (score >= 50) {
    return "orange";
  }
  return "red";
}

function inferVerdictLabel(score) {
  if (score >= 70) {
    return "Highly Credible";
  }
  if (score >= 60) {
    return "Somewhat Credible";
  }
  if (score >= 50) {
    return "Low Credibility";
  }
  return "Not Credible";
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function shouldUseGroundedVerification(content, hasImage) {
  if (hasImage) {
    return true;
  }

  const normalizedContent = (content || "").trim();
  const claimSignals =
    /\b\d{1,4}\b|%|\$|ksh|million|billion|according to|reported|study|research|official|breaking|news|claim|confirmed|announced|cases|deaths|votes|election|vaccine|virus|earthquake|flood|war\b/i;
  const sentenceCount = normalizedContent
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  return (
    normalizedContent.length >= 180 ||
    sentenceCount >= 2 ||
    claimSignals.test(normalizedContent)
  );
}

function buildVerificationPrompt(content, grounded) {
  const modeInstruction = grounded
    ? "Use an evidence-first verification approach. If live web retrieval is unavailable, be explicit about uncertainty and recommend concrete checks."
    : "Use a rapid credibility triage. Do not wait for live grounding. Base the result on internal reasoning, obvious red flags, and claim structure. Keep recommended checks practical.";

  return `${evidenceVerificationPrompt}\n${modeInstruction}\n\n${content}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableVerificationError(error) {
  const status = error?.status;
  const message = String(error?.message || "");

  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    message.includes("fetch failed") ||
    message.includes("UNAVAILABLE")
  );
}

async function generateVerificationResponse(ai, prompt, maxAttempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let isMultimodal = Array.isArray(prompt);
      let modelToUse = isMultimodal ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
      
      let promptWithJsonInstruction = typeof prompt === 'string' 
        ? prompt + "\n\nYou MUST output a valid JSON object matching the requested schema."
        : prompt;

      let requestConfig = {
        messages: [{ role: "user", content: promptWithJsonInstruction }],
        model: modelToUse,
      };

      if (!isMultimodal) {
        requestConfig.response_format = { type: "json_object" };
      }
      
      const completion = await ai.chat.completions.create(requestConfig);
      
      let contentString = completion.choices[0].message.content;
      if (contentString.includes("\`\`\`json")) {
        contentString = contentString.split("\`\`\`json")[1].split("\`\`\`")[0].trim();
      } else if (contentString.includes("\`\`\`")) {
        contentString = contentString.split("\`\`\`")[1].split("\`\`\`")[0].trim();
      }

      return {
        text: contentString,
        candidates: []
      };
    } catch (error) {
      lastError = error;
      const status = error?.status;
      if (attempt === maxAttempts || (status !== 429 && status !== 500 && status !== 503)) {
        throw error;
      }

      console.error(
        `Verification request failed on attempt ${attempt}, retrying:`,
        error
      );
      await sleep(1000 * attempt);
    }
  }

  throw lastError;
}

function parseStoredVerification(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Error parsing verification JSON:", error);
    return null;
  }
}

function extractGroundingMetadata(response) {
  return response?.candidates?.[0]?.groundingMetadata || null;
}

function extractGroundedSources(response) {
  const metadata = extractGroundingMetadata(response);
  const chunks = metadata?.groundingChunks || [];
  const seen = new Set();
  const sources = [];

  chunks.forEach((chunk) => {
    const candidate = chunk.web || chunk.retrievedContext || chunk.maps;
    const url = candidate?.uri;
    if (!url || seen.has(url)) {
      return;
    }

    seen.add(url);
    sources.push({
      title: candidate.title || candidate.text || "Source",
      url,
      domain: candidate.domain || "",
    });
  });

  return sources.slice(0, 6);
}

function extractEvidenceTraces(response, sources) {
  const metadata = extractGroundingMetadata(response);
  const supports = metadata?.groundingSupports || [];
  const chunks = metadata?.groundingChunks || [];

  return supports
    .map((support) => {
      const segmentText = support?.segment?.text;
      const citedSources = safeArray(support?.groundingChunkIndices)
        .map((index) => {
          const chunk = chunks[index];
          const candidate = chunk?.web || chunk?.retrievedContext || chunk?.maps;
          if (!candidate?.uri) {
            return null;
          }

          return (
            sources.find((source) => source.url === candidate.uri) || {
              title: candidate.title || candidate.text || "Source",
              url: candidate.uri,
              domain: candidate.domain || "",
            }
          );
        })
        .filter(Boolean);

      if (!segmentText || citedSources.length === 0) {
        return null;
      }

      return {
        segment: segmentText,
        sources: citedSources.slice(0, 3),
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeVerificationResult(aiResponse, response) {
  const score = Number.isFinite(aiResponse?.credibilityScore)
    ? aiResponse.credibilityScore
    : 35;
  const sources = extractGroundedSources(response);
  const metadata = extractGroundingMetadata(response);

  return {
    credibilityScore: score,
    verdict_label: aiResponse?.verdict_label || inferVerdictLabel(score),
    verdict_color: aiResponse?.verdict_color || inferVerdictColor(score),
    explanation:
      aiResponse?.explanation ||
      "Verification completed with limited evidence. Review the listed sources before relying on this content.",
    date_of_check:
      aiResponse?.date_of_check || new Date().toISOString().slice(0, 10),
    verification_methodology:
      aiResponse?.verification_methodology ||
      (sources.length > 0
        ? "Grounded web verification with claim decomposition."
        : "Model-only verification with no grounded sources returned."),
    key_claims: safeArray(aiResponse?.key_claims).slice(0, 3),
    supporting_evidence: safeArray(aiResponse?.supporting_evidence).slice(0, 3),
    contradicting_evidence: safeArray(aiResponse?.contradicting_evidence).slice(
      0,
      3
    ),
    recommended_checks: safeArray(aiResponse?.recommended_checks).slice(0, 3),
    sources,
    retrieval_queries: safeArray(
      metadata?.webSearchQueries || metadata?.retrievalQueries
    ).slice(0, 5),
    evidence_traces: extractEvidenceTraces(response, sources),
  };
}

async function ensureVerificationColumns() {
  if (verificationColumnsEnsured) {
    return;
  }

  const connection = await connectionPromise;
  const [verificationColumn] = await connection.query(
    "show columns from posts like 'verification_json'"
  );

  if (verificationColumn.length === 0) {
    await connection.query(
      "alter table posts add column verification_json longtext null"
    );
  }

  const [sectorColumn] = await connection.query(
    "show columns from posts like 'sector'"
  );
  if (sectorColumn.length === 0) {
    await connection.query(
      "alter table posts add column sector varchar(255) default 'General'"
    );
  }

  const [claimCountColumn] = await connection.query(
    "show columns from posts like 'claim_count'"
  );
  if (claimCountColumn.length === 0) {
    await connection.query(
      "alter table posts add column claim_count int default 1"
    );
  }

  const [createdAtColumn] = await connection.query(
    "show columns from posts like 'created_at'"
  );
  if (createdAtColumn.length === 0) {
    await connection.query(
      "alter table posts add column created_at timestamp default current_timestamp"
    );
  }

  const [aiGeneratedColumn] = await connection.query(
    "show columns from posts like 'is_ai_generated'"
  );
  if (aiGeneratedColumn.length === 0) {
    await connection.query(
      "alter table posts add column is_ai_generated tinyint(1) default 0"
    );
  }

  verificationColumnsEnsured = true;
}

//Generate hash for  image name
function generateHash(data) {
  let hash = crpto.createHash("sha256").update(data).digest("hex");
  return hash;
}

async function fileToGenerativePart(path, mimeType) {
  const base64Str = fs.readFileSync(path, { encoding: "base64" });
  return {
    type: "image_url",
    image_url: {
      url: `data:${mimeType};base64,${base64Str}`
    }
  };
}

//Web Socket for chatbot
const wss = new ws.Server({ port: process.env.WSS });
console.log("Web Socket server started on ws://localhost:5001");

const idempotentKeys = [];

wss.on("connection", async function (ws) {
  ws.on("message", async function (clientData) {
    let messsage = clientData.toString();
    message = await JSON.parse(messsage);
    let key = messsage.key;
    let keyExists = false;
    for (let i = 0; i < idempotentKeys.length; i++) {
      if (key == idempotentKeys[i]) {
        keyExists = true;
      }
    }
    let emailValue = message.user;
    if (!keyExists) {
      idempotentKeys.push(key);
      let connection = await connectionPromise;

      await connection.query(
        "update users set rep_points = rep_points + 1 where email = ?",
        [emailValue]
      );

      console.log("Updated rep points");
    }

    const prompt = message.promptToSend;
    const chatbot = getGroqClient();
    try {
      const completion = await chatbot.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: milesPersona }, { role: "user", content: prompt }],
      });

      if (completion.choices[0].message.content) {
        ws.send(completion.choices[0].message.content);
      }
    } catch (e) {
      ws.send("I'm currently unable to respond. Please try again later.");
    }
  });

  ws.on("close", function () {
    console.log("Client Disconnected");
  });
});

// Profile page
router.get("/profile", (req, res) => {
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
  async function main() {
    let connection = await connectionPromise;
    var user = req.session.user.email;
    var [userInfo] = await connection.query(
      "select username, rep_points, reviews_given, no_of_posts from users where email = ?",
      [user]
    );
    userInfo = userInfo[0];
    res.render("profile", { userInfo });
  }
});

//Logging out
router.post("/profile", (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error occured why logging out.");
        return res.status(500).send("Could not log out");
      } else {
        return res.redirect("/signin");
      }
    });
  }
});

//Posting page
router.get("/post", (req, res) => {
  if (req.session.user) {
    res.render("post");
  } else {
    res.render("401");
  }
});

router.post("/post", upload.single("image"), (req, res) => {
  async function imageEval(prompt, fileName) {
    const ai = getGroqClient();
    const completion = await ai.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [{ role: "user", content: prompt }],
    });

    if (completion.choices[0].message.content) {
      let responseText = completion.choices[0].message.content;
      let source = path.join(__dirname, "../eval", "images", fileName);
      let destination = path.join(__dirname, "../public", "posts", fileName);
      await fs.copyFile(source, destination, (err) => {
        if (err) {
          console.error("Error while copying file from evaluation:\n" + err);
          return;
        }
        console.log("Copied file to posts folder");
      });
      await fs.unlink(source, (err) => {
        if (err) {
          console.error(
            "Error while deleting copied file from evaluation:\n" + err
          );
          return;
        }
        console.log("Sucessfully deleted image from evaluation.");
      });

      let output = [fileName, responseText];
      console.log("Evaluation success!");

      return output;
    } else {
      //Delete the file and send error message
      console.log("Evaluation failed");
      let imagepath = path.join(__dirname, "../eval", "images", fileName);
      fs.unlink(imagepath, (err) => {
        if (err) {
          console.error("Error while deleting evaluated image: \n" + err);
          return;
        }
        console.log("Image deleted.");
      });
      return res.json({
        message:
          "Inappropriate content detected! Please upload data that aligns with our guidelines.\n",
        color: "red",
      });
    }
  }

  async function checkCredibility(prompt, useGrounding) {
    const ai = getGroqClient();
    const response = await generateVerificationResponse(ai, prompt);

    if (!response.text) {
      console.log(response.promptFeedback);
      throw new Error("No verification response was returned by the model.");
    }

    const result = normalizeVerificationResult(JSON.parse(response.text), response);

    // Detect AI-generated content with a fast secondary call
    try {
      const textToCheck = typeof prompt === 'string' ? prompt : (Array.isArray(prompt) ? prompt.find(p => p.type === 'text')?.text || '' : '');
      if (textToCheck.length > 50) {
        const aiDetectCompletion = await ai.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `Does the following text appear to have been written by an AI or LLM (ChatGPT, Claude, Gemini, etc.)? Look for uniform structure, lack of personal voice, unnaturally polished language, and generic phrasing. Respond ONLY with a JSON object: {"is_ai_generated": true/false, "confidence": "high"|"medium"|"low"}\n\nText:\n${textToCheck.substring(0, 1000)}`
          }],
          response_format: { type: "json_object" }
        });
        const aiDetectResult = JSON.parse(aiDetectCompletion.choices[0].message.content);
        result.is_ai_generated = aiDetectResult.is_ai_generated === true && aiDetectResult.confidence !== 'low';
      } else {
        result.is_ai_generated = false;
      }
    } catch (aiDetectErr) {
      console.warn("AI detection failed (non-critical):", aiDetectErr.message);
      result.is_ai_generated = false;
    }

    return result;
  }

  async function main() {
    if (req.session.user) {
      await ensureVerificationColumns();
      ensureUploadDirectories();
      fs.readdir(
        path.join(__dirname, "../eval", "images"),
        async (err, files) => {
          if (err) {
            console.error(
              "Error while reading dir for image evaluation:\n" + err
            );
            return res.status(500).json({
              message: "Could not prepare the verification workspace.",
              color: "red",
            });
          } else {
            try {
              let content = await req.body.content;
              let hash = generateHash(content);
              let targetFile = "";
              hash = hash.substring(43, 63);
              files.forEach((file) => {
                let name = file.split(".")[0];
                if (name == hash) {
                  targetFile = file;
                }
              });

              var imagePath = "";
              var ext = "";
              var dbImagePath = null;
              var imagePassedToAi = null;
              if (targetFile.trim() != "") {
                imagePath = path.join(__dirname, "../eval", "images", targetFile);
                ext = targetFile.split(".")[1];
                const imageMimeType = "image/" + ext;
                const image = await fileToGenerativePart(imagePath, imageMimeType);
                imagePassedToAi = image;

                console.log("Evaluating image");
                var multimodalPrompt = [
                  { type: "text", text: imageEvalPrompt },
                  imagePassedToAi
                ];
                var output = await imageEval(multimodalPrompt, targetFile);
                if (!Array.isArray(output)) return;
                dbImagePath = "posts/" + output[0];
              }

              var postId = generateHash(content);
              postId = postId.substring(33, 63);
              var imageLocation = dbImagePath;
              var textContent = content;
              var author = req.session.user.email.split("@")[0];

              const useGrounding = shouldUseGroundedVerification(content, Boolean(imagePassedToAi));
              let aiPrompt = buildVerificationPrompt(content, useGrounding);

              if (imagePassedToAi) {
                multimodalPrompt = [
                  { type: "text", text: aiPrompt },
                  imagePassedToAi
                ];
              } else {
                multimodalPrompt = aiPrompt;
              }

              var aiResponse = await checkCredibility(multimodalPrompt, useGrounding);
              var credScore = aiResponse.credibilityScore;
              var aiAnalysis = aiResponse.explanation;
              var dateOfCheck = aiResponse.date_of_check;
              var verdictLabel = aiResponse.verdict_label;
              var verdictColor = aiResponse.verdict_color;
              var sector = req.body.sector || aiResponse.sector || "General";
              var verificationJson = JSON.stringify(aiResponse);
              var sector = req.body.sector || aiResponse.sector || "General";
              if (verdictLabel === "REJECTED_PERSONAL") {
                console.log("Blocked personal/spam post from " + author);
                return res.json({
                  message: "MILES is dedicated to news, claims, and media analysis. Please refrain from personal lifestyle posts, spam, or irrelevant chatter.",
                  color: "red"
                });
              }
              var claimCount = 1;
              try {
                const connection = await connectionPromise;
                const keywords = textContent.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(w => w.length > 4).slice(0, 5);
                if (keywords.length > 0) {
                  const likeClause = keywords.map(() => "text_content LIKE ?").join(" OR ");
                  const likeValues = keywords.map(w => `%${w}%`);
                  const [similar] = await connection.query(`SELECT COUNT(*) as cnt FROM posts WHERE ${likeClause}`, likeValues);
                  claimCount = (similar[0].cnt || 0) + 1;
                }
              } catch (claimErr) {
                console.warn("Claim count error:", claimErr.message);
              }

              // Guardrail Check: Block Personal/Spam Posts
              if (verdictLabel === "REJECTED_PERSONAL") {
                console.log("Blocked personal/spam post from " + author);
                return res.json({
                  message: "MILES is dedicated to news, claims, and media analysis. Please refrain from personal lifestyle posts, spam, or irrelevant chatter.",
                  color: "red"
                });
              }

              const connection = await connectionPromise;

              // Claim Detection: Count similar posts
              var claimCount = 1;
              const keywords = textContent.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(w => w.length > 4).slice(0, 5);
              if (keywords.length > 0) {
                const likeClause = keywords.map(() => 'text_content LIKE ?').join(' OR ');
                const [similar] = await connection.query(`SELECT COUNT(*) as cnt FROM posts WHERE ${likeClause}`, keywords.map(w => `%${w}%`));
                claimCount = (similar[0].cnt || 0) + 1;
              }

              // Add data to database.
              let dbQuery = "insert into posts(post_id, author, image_location, text_content, credibility_score, date_of_check, verdict_label, verdict_color, ai_analysis, sector, claim_count, created_at, verification_json, is_ai_generated) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?);";
              let dbArray = [postId, author, imageLocation, textContent, credScore, dateOfCheck, verdictLabel, verdictColor, aiAnalysis, sector, claimCount, verificationJson, aiResponse.is_ai_generated ? 1 : 0];
              await connection.query(dbQuery, dbArray);

              // Auto-delete safety net
              await connection.query("DELETE FROM posts WHERE verdict_label = 'REJECTED_PERSONAL'");

              // Add rep points and posts
              await connection.query("update users set rep_points = rep_points + 1 where email = ?", [req.session.user.email]);
              await connection.query("update users set no_of_posts = no_of_posts + 1 where email = ?", [req.session.user.email]);
              
              console.log("Finished loading to database");
              return res.json({ message: "Successfully posted content. Thank you for your contribution.", color: "blue" });
              await connection.query(
                "update users set rep_points = rep_points + 1 where email = ?",
                [req.session.user.email]
              );
              await connection.query(
                "update users set no_of_posts = no_of_posts + 1 where email = ?",
                [req.session.user.email]
              );
              console.log("Finished loading to database");

              return res.json({
                message:
                  "Successfully posted content. Thank you for your contribution.",
                color: "blue",
              });
            } catch (e) {
              console.error(
                "Error while loading to database. Error Code: " +
                  e.code +
                  "\n" +
                  e
              );
              return res.status(500).json({
                message:
                  "Verification failed on the server. Check the terminal log for the exact error.",
                color: "red",
              });
            }
          }
        }
      );
    } else {
      res.render("401");
    }
  }

  main().catch((error) => {
    console.error("Unexpected post route error:", error);
    if (!res.headersSent) {
      return res.status(500).json({
        message: "Unexpected verification error.",
        color: "red",
      });
    }
  });
});

//Home page
router.get("/", (req, res) => {
  async function main() {
    await ensureVerificationColumns();
    //Fetch posts from database
    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis, sector, claim_count, created_at, verification_json, is_ai_generated from posts order by created_at desc limit 20;"
    );

    //Fetch comments/reviews from database
    var [comments] = await connection.query(
      "select comment_id, post_id, review, commenter from comments"
    );

    //Add a comment element for each post
    posts.forEach((post) => {
      post.comments = [];
      post.verification = parseStoredVerification(post.verification_json);
    });

    postsCounter = 0;
    comments.forEach((comment) => {
      posts.forEach((post) => {
        if (comment.post_id == post.post_id) {
          post.comments.push(comment);
        }
      });
    });

    res.render("index", { posts, pageTitle: "Media Literacy Feed", currentSector: null });
  }
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
});

// Search page
router.get("/search", (req, res) => {
  const searchQuery = req.query.q || "";

  async function main() {
    await ensureVerificationColumns();
    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis, sector, claim_count, created_at, verification_json from posts where text_content like ? or author like ? order by created_at desc limit 30;",
      [`%${searchQuery}%`, `%${searchQuery}%`]
    );

    //Fetch comments/reviews from database
    var [comments] = await connection.query(
      "select comment_id, post_id, review, commenter from comments"
    );

    //Add a comment element for each post
    posts.forEach((post) => {
      post.comments = [];
      post.verification = parseStoredVerification(post.verification_json);
    });

    comments.forEach((comment) => {
      posts.forEach((post) => {
        if (comment.post_id == post.post_id) {
          post.comments.push(comment);
        }
      });
    });

    res.render("index", { 
      posts, 
      pageTitle: `Search Results for "${searchQuery}"`, 
      currentSector: null,
      searchQuery
    });
  }
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
});

// Sector pages
router.get("/sectors/:sectorName", (req, res) => {
  let sectorName = req.params.sectorName;
  // Capitalize sector name
  sectorName = sectorName.charAt(0).toUpperCase() + sectorName.slice(1).toLowerCase();

  async function main() {
    //Fetch posts from database for this specific sector
    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis, sector, claim_count, created_at, verification_json from posts where LOWER(sector) = LOWER(?) order by created_at desc limit 20;",
      [sectorName]
    );

    //Fetch comments/reviews from database
    var [comments] = await connection.query(
      "select comment_id, post_id, review, commenter from comments"
    );

    //Add a comment element for each post
    posts.forEach((post) => {
      post.comments = [];
    });

    postsCounter = 0;
    comments.forEach((comment) => {
      posts.forEach((post) => {
        if (comment.post_id == post.post_id) {
          post.comments.push(comment);
        }
      });
    });

    res.render("index", { posts, pageTitle: sectorName + " Sector", currentSector: sectorName });
  }
  
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
});

//My posts page
router.get("/myposts", (req, res) => {
  async function main(user) {
    await ensureVerificationColumns();
    //Fetch data fom database

    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis, sector, claim_count, created_at, verification_json from posts where author = ? order by created_at desc limit 10;",
      [user]
    );

    posts.forEach((post) => {
      post.verification = parseStoredVerification(post.verification_json);
    });

    res.render("myposts", { posts });
  }
  if (req.session.user) {
    let email = req.session.user.email;
    let author = email.split("@")[0];
    main(author);
  } else {
    res.render("401");
  }
});

//Deleting posts
router.delete("/posts", (req, res) => {
  async function main(id) {
    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "delete from posts where post_id = ?",
      [id]
    );

    res.json({ message: "Deleted" });
  }

  if (req.session.user) {
    let postId = req.body.id;
    main(postId);
  } else {
    res.render("401");
  }
});

// Comments endpoint
router.post("/comments", (req, res) => {
  async function main() {
    var commenter = req.body.commenter;
    var review = req.body.review;
    var postId = req.body.postId;
    var commentId = generateHash(review);
    commentId = commentId.substring(33, 63);

    const connection = await connectionPromise;
    await connection.query(
      "insert into comments(comment_id, post_id, commenter, review)values(?, ?, ?, ?)",
      [commentId, postId, commenter, review]
    );

    await connection.query(
      "update users set reviews_given = reviews_given + 1 where email = ?",
      [req.session.user.email]
    );

    console.log("Finished loading comments");
    res.json({ message: "sent" });
  }
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
});

// Verify Comment endpoint
router.post("/verify-comment", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { comment } = req.body;
  if (!comment || comment.trim() === "") {
    return res.status(400).json({ error: "No comment provided" });
  }

  try {
    const ai = getGroqClient();
    const promptText = `You are a fact-checking assistant for MILES. Evaluate the following user comment for credibility.
Return evaluate credibility on a 0-100 scale. Provide a label, color, and explanation. If the comment is purely an opinion or greeting, label it as "Opinion/Unverifiable" and color it "gray".

You MUST output a valid JSON object with the following keys EXACTLY:
"credibility_score" (number), "verdict_label" (string), "verdict_color" (string), "explanation" (string).

Comment: "${comment}"`;

    const completion = await ai.chat.completions.create({
      messages: [{ role: "user", content: promptText }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error("Comment verification error:", error);
    res.status(500).json({ 
      verdict_label: "Verification Failed", 
      verdict_color: "red", 
      explanation: "Could not verify this comment at the moment due to an AI error or rate limit."
    });
  }
});

//Chatbot page
router.get("/chatbot", (req, res) => {
  if (req.session.user) {
    res.render("chatbot");
  } else {
    res.render("401");
  }
});

module.exports = router;

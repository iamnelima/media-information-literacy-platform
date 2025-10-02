const express = require("express");
require("dotenv").config();
const { GoogleGenAI, Type } = require("@google/genai");
const router = express.Router();
const connectionPromise = require("./connection.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crpto = require("crypto");
const { type } = require("os");
const storage = multer.diskStorage({
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 Megabytes in bytes
    files: 5, // Max 5 files
    fieldSize: 10 * 1024 * 1024,
  },
  destination: (req, file, cb) => {
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

**EXAMPLE:**

{
    "credibility_score": 85,
    "verdict_label": "Highly Credible",
    "verdict_color": "green",
    "explanation": "Multiple primary sources and a fact-check confirm this; no contradictory evidence found."

}

Here is the content:

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
        'greather or equal to 70 = "Highly Credible" (green), 60 to 69 = "Somewhat Credible" (yellow), 50 to 59 = "Low Credibility" (orange), less than 50 = "Not Credible" (red)',
    },
    verdict_color: {
      type: Type.STRING,
      description:
        'greather or equal to 70 = "Highly Credible" (green), 60 to 69 = "Somewhat Credible" (yellow), 50 to 59 = "Low Credibility" (orange), less than 50 = "Not Credible" (red)',
    },
    explanation: {
      type: Type.STRING,
      description: "Detailed summary and rationale for the final verdict.",
    },
    date_of_check: {
      type: Type.STRING,
      description: "The date the check was performed (YYYY-MM-DD).",
    },
  },
};

//Generate hash for  image name
function generateHash(data) {
  let hash = crpto.createHash("sha256").update(data).digest("hex");
  return hash;
}

async function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(path, { encoding: "base64" }),
      mimeType,
    },
  };
}

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
      "select username, cred_score, reviews_given, rep_points from users where email = ?",
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
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    if (response.text) {
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

      let output = [fileName, response.text];
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

  async function checkCredibility(prompt) {
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseStructure,
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    } else {
      console.log(response.promptFeedback);
    }
  }

  async function main() {
    if (req.session.user) {
      fs.readdir(
        path.join(__dirname, "../eval", "images"),
        async (err, files) => {
          if (err) {
            console.err(
              "Error while reading dir for image evaluation:\n" + err
            );
            return;
          } else {
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
              //If the image exists
              imagePath = path.join(__dirname, "../eval", "images", targetFile);
              ext = targetFile.split(".")[1];
              const imageMimeType = "image/" + ext;

              //Create image part for the model
              const image = await fileToGenerativePart(
                imagePath,
                imageMimeType
              );
              imagePassedToAi = image;
              //Create an array for a multimodal prompt
              console.log("Evaluating image");
              var multimodalPrompt = [image, { text: imageEvalPrompt }];
              var output = await imageEval(multimodalPrompt, targetFile); // returns array of filename and response.text if evaal is successful
              dbImagePath = "posts/" + output[0];
              console.log("Out of image evaluation function");
            }

            // Analyze the data and determine credibility
            var postId = generateHash(content);
            postId = postId.substring(33, 63);
            var imageLocation = dbImagePath;
            var textContent = content;
            var author = req.session.user.email.split("@")[0];

            if (imagePassedToAi) {
              multimodalPrompt = [
                imagePassedToAi,
                { text: credibilityPrompt + content },
              ];
            } else {
              multimodalPrompt = credibilityPrompt + content;
            }
            var aiResponse = await checkCredibility(multimodalPrompt);
            var credScore = aiResponse.credibilityScore;
            var aiAnalysis = aiResponse.explanation;
            var dateOfCheck = aiResponse.date_of_check;
            var verdictLabel = aiResponse.verdict_label;
            var verdictColor = aiResponse.verdict_color;

            /*
            console.log({
              postId,
              author,
              imageLocation,
              textContent,
              credScore,
              dateOfCheck,
              verdictLabel,
              verdictColor,
              aiAnalysis,
            });
           */

            // Add data to database.
            try {
              const connection = await connectionPromise;

              let dbQuery =
                "insert into posts(post_id, author, image_location, text_content, credibility_score, date_of_check, verdict_label, verdict_color, ai_analysis) values(?, ?, ?, ?, ?, ?, ?, ?, ? );";
              let dbArray = [
                postId,
                author,
                imageLocation,
                textContent,
                credScore,
                dateOfCheck,
                verdictLabel,
                verdictColor,
                aiAnalysis,
              ];
              await connection.query(dbQuery, dbArray);
              console.log("Finished loading to database");

              //Send response to user.
              res.json({
                message:
                  "Successfully posted content. Thank you for your contribution.",
                color: "blue",
              });
            } catch (e) {
              console.log(
                "Error while loading to database. Error Code: " +
                  e.code +
                  "\n" +
                  e
              );
            }
          }
        }
      );
    } else {
      res.render("401");
    }
  }

  main();
});

//Home page
router.get("/", (req, res) => {
  async function main() {
    //Fetch posts from database
    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis from posts limit 10;"
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

    res.render("index", { posts });
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
    //Fetch data fom database

    const connection = await connectionPromise;
    var [posts] = await connection.query(
      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis from posts where author = ? limit 10;",
      [user]
    );

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

    console.log("Finished loading comments");
    res.json({ message: "sent" });
  }
  if (req.session.user) {
    main();
  } else {
    res.render("401");
  }
});

module.exports = router;

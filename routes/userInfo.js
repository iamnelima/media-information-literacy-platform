const express = require("express");
const session = require("express-session");
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const router = express.Router();
const connectionPromise = require("./connection.js");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crpto = require("crypto");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../eval", "images"));
  },
  filename: (req, file, cb) => {
    async function assignName(r) {
      let request = await r;
      let content = request.body.content;
      //console.log(request);
      console.log(content);
      let contentHash = generateHash(content);
      contentHash = contentHash.substring(44, 63);
      let ext = file.mimetype.split("/")[1];
      let name = contentHash;
      return cb(null, name + "." + ext);
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

//Generate hash for  image name
function generateHash(data) {
  console.log(data);
  let hash = crpto.createHash("sha256").update(data).digest("hex");
  return hash;
}

function fileToGenerativePart(path, mimeType) {
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
    res.render("404");
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
    res.render("404");
  }
});

router.post("/post", upload.single("image"), (req, res) => {
  async function main(prompt, fileName) {
    try {
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      if (response.text) {
        let source = path.join(__dirname, "../eval", "images", fileName);
        let destination = path.join(__dirname, "../public", "posts", fileName);
        await fs.copyFile(source, destination);
        await fs.unlink(source, (err) => {
          if (err) {
            console.error(
              "Error while deleting copied file from evaluation:\n" + err
            );
          }
        });
        console.log(response);
      } else {
        //Delete the file and send error message
        let imagepath = path.join(__dirname, "../eval", "images", fileName);
        fs.unlink(imagepath, (err) => {
          if (err) {
            console.error("Error while deleting evaluated image: \n" + err);
            return;
          }
        });
        return res.json({
          message:
            "Inappropriate content detected! Please upload data that aligns with our guidelines.\n",
        });
      }
    } catch (e) {
      console.log("Error with Gemini:\n" + e);
    }
  }

  if (req.session.user) {
    //main();
    fs.readdir(path.join(__dirname, "../eval", "images"), (err, files) => {
      if (err) {
        console.err("Error while reading dir for image evaluation:\n" + err);
        return;
      } else {
        console.log(req.body.content);
        let content = req.body.content;
        let hash = generateHash(content);
        let targetFile = "";
        hash = hash.substring(44, 63);
        files.forEach((file) => {
          let name = file.split(".")[0];
          if (name == hash) {
            targetFile = file;
          }
        });

        const imagePath = path.join(__dirname, "../eval", "images", targetFile);
        let ext = targetFile.split(".")[1];
        const imageMimeType = "image/" + ext;

        //Create image part for the model
        const image = fileToGenerativePart(imagePath, imageMimeType);

        //Create an array for a multimodal prompt

        const multimodalPrompt = [image, { text: imageEvalPrompt }];
        main(multimodalPrompt, targetFile);
      }
    });

    fs;
  } else {
    res.render("404");
  }
});

module.exports = router;

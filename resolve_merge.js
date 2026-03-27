const fs = require('fs');
let text = fs.readFileSync('routes/userInfo.js', 'utf8');

// Use native split on string from char code to be safe
let nl = String.fromCharCode(10);
let lines = text.split(nl);
let out = [];
let i = 0;

while (i < lines.length) {
    let line = lines[i];
    if (line.endsWith('\r')) {
        line = line.slice(0, -1);
    }
    
    if (line.startsWith('<<<<<<< HEAD') && i > 750 && i < 800) {
        while (!lines[i].startsWith('>>>>>>> sectors-feature-update')) {
            i++;
        }
        i++; 
        continue;
    }
    
    if (line.startsWith('<<<<<<< HEAD') && i > 950 && i < 1000) {
        out.push('              let dbQuery =');
        out.push('                "insert into posts(post_id, author, image_location, text_content, credibility_score, date_of_check, verdict_label, verdict_color, ai_analysis, verification_json, sector, claim_count, created_at) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW());";');
        out.push('              let dbArray = [');
        out.push('                postId,');
        out.push('                author,');
        out.push('                imageLocation,');
        out.push('                textContent,');
        out.push('                credScore,');
        out.push('                dateOfCheck,');
        out.push('                verdictLabel,');
        out.push('                verdictColor,');
        out.push('                aiAnalysis,');
        out.push('                verificationJson,');
        out.push('                sector,');
        out.push('                claimCount,');
        out.push('              ];');
        out.push('              await connection.query(dbQuery, dbArray);');
        out.push('');
        out.push('              // Auto-delete safety net: remove any post that slipped past guardrails');
        out.push('              await connection.query(');
        out.push('                "DELETE FROM posts WHERE verdict_label = \\\'REJECTED_PERSONAL\\\'"');
        out.push('              );');
        
        while (!lines[i].startsWith('>>>>>>> sectors-feature-update')) {
            i++;
        }
        i++; 
        continue;
    }

    if (line.startsWith('<<<<<<< HEAD') && i > 1040 && i < 1100) {
        out.push('      "select post_id, author, image_location, text_content, credibility_score, verdict_label, verdict_color, ai_analysis, verification_json, sector, claim_count, created_at from posts order by created_at desc limit 20;"');
        while (!lines[i].startsWith('>>>>>>> sectors-feature-update')) {
            i++;
        }
        i++; 
        continue;
    }

    out.push(line);
    if (line.includes('var verificationJson = JSON.stringify(aiResponse);')) {
        out.push('              var sector = req.body.sector || aiResponse.sector || "General";');
        out.push('              if (verdictLabel === "REJECTED_PERSONAL") {');
        out.push('                console.log("Blocked personal/spam post from " + author);');
        out.push('                return res.json({');
        out.push('                  message: "MILES is dedicated to news, claims, and media analysis. Please refrain from personal lifestyle posts, spam, or irrelevant chatter.",');
        out.push('                  color: "red"');
        out.push('                });');
        out.push('              }');
        out.push('              var claimCount = 1;');
        out.push('              try {');
        out.push('                const connection = await connectionPromise;');
        out.push('                const keywords = textContent.replace(/[^a-zA-Z0-9 ]/g, "").split(" ").filter(w => w.length > 4).slice(0, 5);');
        out.push('                if (keywords.length > 0) {');
        out.push('                  const likeClause = keywords.map(() => "text_content LIKE ?").join(" OR ");');
        out.push('                  const likeValues = keywords.map(w => `%${w}%`);');
        out.push('                  const [similar] = await connection.query(`SELECT COUNT(*) as cnt FROM posts WHERE ${likeClause}`, likeValues);');
        out.push('                  claimCount = (similar[0].cnt || 0) + 1;');
        out.push('                }');
        out.push('              } catch (claimErr) {');
        out.push('                console.warn("Claim count error:", claimErr.message);');
        out.push('              }');
    }
    i++;
}

// Write file using correct CharCode based newline!
fs.writeFileSync('routes/userInfo.js', out.join(nl), 'utf8');
console.log("Resolved properly with newlines intact");

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

// Gemini 2.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.post("/screen", upload.array("resumes"), async (req, res) => {
  try {
    console.log("Request received");

    const jobDesc = req.body.jobDescription;
    if (!jobDesc || !req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Missing job description or resumes" });
    }

    let results = [];

    for (let file of req.files) {
      let resumeText = "";
      try {
        // Read PDF buffer
        const buffer = fs.readFileSync(file.path);

        // Try to parse PDF
        const pdf = await pdfParse(buffer);
        resumeText = pdf.text;

      } catch (pdfErr) {
        console.error(`Failed to parse PDF: ${file.originalname}`, pdfErr.message);
        // If PDF fails, we continue with empty text
        resumeText = "";
      }

      // Prepare Gemini prompt
      const prompt = `
You are an ATS resume screening system. Extract structured information from the resume text.

JOB DESCRIPTION:
${jobDesc}

RESUME:
${resumeText}

Tasks:
1. Extract Candidate Name.
2. Extract Email.
3. Identify matching skills from the job description.
4. Identify missing skills (skills in job description but not in resume).
5. Provide a short 2-3 line HR-friendly summary.
6. Calculate a match score 0-100.

Return ONLY valid JSON in this format:
{
  "name": "Candidate Name",
  "email": "candidate@example.com",
  "matching_skills": ["skill1","skill2"],
  "missing_skills": ["skill3","skill4"],
  "summary": "Short HR-friendly summary",
  "match_score": number
}
`;

      try {
        const response = await model.generateContent(prompt);

        // Remove code block markdown if present
        let text = response.response.text();
        text = text.replace(/```json|```/g, "").trim();

        const analysis = JSON.parse(text);

        results.push({
          file_name: file.originalname,
          name: analysis.name,
          email: analysis.email,
          matching_skills: analysis.matching_skills,
          missing_skills: analysis.missing_skills,
          summary: analysis.summary,
          match_score: analysis.match_score
        });

      } catch (aiErr) {
        console.error(`AI analysis failed for: ${file.originalname}`, aiErr.message);
        results.push({
          file_name: file.originalname,
          name: "",
          email: "",
          matching_skills: [],
          missing_skills: [],
          summary: "AI analysis failed",
          match_score: 0
        });
      } finally {
        fs.unlinkSync(file.path); // always remove temp file
      }
    }

    // Sort by match score descending
    results.sort((a, b) => b.match_score - a.match_score);

    // Generate PDF report
    generatePDF(results);

    res.json(results);

  } catch (err) {
    console.error("SERVER ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// PDF generator
function generatePDF(results) {
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream("screening_report.pdf"));

  doc.fontSize(18).text("Resume Screening Report\n\n");

  results.forEach((r, i) => {
    doc.fontSize(12).text(
      `${i + 1}. File: ${r.file_name}
Name: ${r.name}
Email: ${r.email}
Match Score: ${r.match_score}%
Matching Skills: ${r.matching_skills.join(", ")}
Missing Skills: ${r.missing_skills.join(", ")}
Summary: ${r.summary}\n\n`
    );
  });

  doc.end();
}

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});

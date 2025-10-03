import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const PDFParser = require("pdf2json");

// Load environment variables
dotenv.config({ path: "../.env" });

// Check if Gemini API key exists
if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
  console.error("❌ GEMINI_API_KEY not configured!");
  console.error("Please set your Gemini API key in the .env file");
  console.error("Get your key from: https://ai.google.dev/gemini-api/docs/api-key");
  process.exit(1);
}

// Load Gemini key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Create MCP server
const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

// Hello World Tool
server.registerTool(
  "hello.world",
  {
    title: "Hello World Tool",
    description: "Returns a hello world message",
    inputSchema: { name: z.string() },
  },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}! Your MCP server is working.` }],
  })
);

// Gemini Ask Tool
server.registerTool(
  "gemini.ask",
  {
    title: "Gemini Ask Tool",
    description: "Ask Gemini a question via API",
    inputSchema: { prompt: z.string() },
  },
  async ({ prompt }) => {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    } catch (error) {
      console.error("❌ Gemini API Error:", error);
      return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
  }
);

// =======================
// Express app
// =======================
const app = express();

// ✅ Allow frontend (Next.js on multiple ports and Vite on port 5173) to call backend
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3000"] }));
app.use(express.json());

// Configure multer for file uploads (store in memory)
const upload = multer({ storage: multer.memoryStorage() });

// =======================
// 📌 PDF Upload & Parse API
// =======================
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    console.log("📄 Parsing PDF...");

    // Parse PDF using pdf2json
    const pdfParser = new PDFParser();

    const extractedText = await new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData) => {
        console.error("PDF Parser Error:", errData.parserError);
        reject(errData.parserError);
      });

      pdfParser.on("pdfParser_dataReady", (pdfData) => {
        // Extract text from all pages
        let text = "";
        pdfData.Pages.forEach((page) => {
          page.Texts.forEach((textItem) => {
            textItem.R.forEach((r) => {
              text += decodeURIComponent(r.T) + " ";
            });
          });
          text += "\n";
        });
        resolve(text);
      });

      // Parse the buffer
      pdfParser.parseBuffer(req.file.buffer);
    });

    console.log("✅ PDF parsed successfully");
    console.log("📝 Extracted text preview:", extractedText.substring(0, 500));

    // Use Gemini AI to detect class schedule from the extracted text
    console.log("🤖 Calling Gemini AI to parse schedule...");

    const prompt = `
You are a class schedule parser analyzing a weekly calendar PDF (like a university class schedule).

The PDF shows columns for: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday.
Each class appears in the column(s) for the day(s) it occurs.

IMPORTANT: Determine which days each class occurs by:
1. Looking for day names (Monday, Tuesday, etc.) near the class entries in the text
2. Counting how many times a class appears (2 times = likely Tue/Thu, 3 times = likely Mon/Wed/Fri)
3. Using common patterns: "Lecture" classes are often Tue/Thu or Mon/Wed/Fri, "Laboratory" is often once per week

Return ONLY a JSON object with this EXACT schema (no markdown, no explanations):
{
  "classTimes": [
    "Tue 9:30 AM - 10:45 AM - CS 3080 Lecture - Hayes Hall 117",
    "Thu 9:30 AM - 10:45 AM - CS 3080 Lecture - Hayes Hall 117",
    "Mon 10:30 AM - 11:20 AM - MATH 2220 Lecture - McLeod Hall 226",
    "Wed 10:30 AM - 11:20 AM - MATH 2220 Lecture - McLeod Hall 226",
    "Fri 10:30 AM - 11:20 AM - MATH 2220 Lecture - McLeod Hall 226"
  ],
  "courses": [
    {"name": "CS 3080 Lecture", "days": ["Tue", "Thu"], "time": "9:30 AM - 10:45 AM", "location": "Hayes Hall 117"},
    {"name": "MATH 2220 Lecture", "days": ["Mon", "Wed", "Fri"], "time": "10:30 AM - 11:20 AM", "location": "McLeod Hall 226"}
  ]
}

Day abbreviations: Mon, Tue, Wed, Thu, Fri

PDF Text:
${extractedText}

RULES:
- Return ONLY valid JSON (no markdown, no code fences)
- Use 12-hour time format with AM/PM
- Create a separate classTime entry for EACH day a class occurs
- Look carefully at the text for day indicators (Monday/Mon, Tuesday/Tue, etc.)
- If a class appears 2 times at the same time, it's likely Tue & Thu
- If a class appears 3 times at the same time, it's likely Mon, Wed & Fri
`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      let aiResponse = result.response.text().trim();

      console.log("✅ Gemini AI response received");
      console.log("📋 AI Response full text:", aiResponse);

      // Clean AI response (remove code fences if present)
      aiResponse = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim();

      console.log("🧹 Cleaned response:", aiResponse);

      let parsedSchedule;
      try {
        parsedSchedule = JSON.parse(aiResponse);
        console.log("✅ Successfully parsed JSON:", parsedSchedule);
      } catch (err) {
        console.error("❌ AI JSON Parse Error:", err.message);
        console.error("❌ Failed to parse:", aiResponse);
        return res.status(500).json({
          error: "AI could not parse schedule into valid format",
          rawText: extractedText.substring(0, 1000),
          aiResponse: aiResponse.substring(0, 500)
        });
      }

      console.log("📤 Sending response to frontend...");
      res.json({
        success: true,
        schedule: parsedSchedule,
        rawText: extractedText.substring(0, 500)
      });
      console.log("✅ Response sent successfully");
    } catch (aiError) {
      console.error("❌ Gemini AI Error:", aiError);
      return res.status(500).json({
        error: "Failed to process PDF with AI: " + aiError.message,
        rawText: extractedText.substring(0, 1000)
      });
    }

  } catch (err) {
    console.error("❌ PDF Upload Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 📌 Study Schedule API
// =======================
app.post("/schedule", async (req, res) => {
  const { classTimes, studyGoals } = req.body;

  const prompt = `
Generate a weekly STUDY SCHEDULE (NOT classes) as JSON with this EXACT schema. ONLY include Monday through Friday (NO weekends).

CRITICAL: DO NOT include any classes in the schedule. Classes will be added separately by the frontend.
CRITICAL: ONLY create study sessions based on the user's specific study goals: "${studyGoals}"

Use 12-hour time format with AM/PM in 30-minute increments ONLY (e.g., "7:00 AM - 7:30 AM", "7:30 AM - 8:00 AM").

Schedule should look like:
{
  "Monday": {
    "7:00 AM - 7:30 AM": "Practice Coding Problems",
    "7:30 AM - 8:00 AM": "Continue Coding Practice"
  },
  "Tuesday": {
    "7:00 AM - 7:30 AM": "Practice Coding Problems"
  },
  "Wednesday": { ... },
  "Thursday": { ... },
  "Friday": { ... }
}

RULES:
1. NEVER include Saturday or Sunday
2. NEVER include classes - ONLY study sessions
3. Use ONLY 30-minute time slots (e.g., "7:00 AM - 7:30 AM", "7:30 AM - 8:00 AM")
4. AVOID scheduling during these class times: ${classTimes.join(", ")}
5. Create study sessions based SPECIFICALLY on: "${studyGoals}"
6. If the user wants to practice coding, create "Practice Coding" sessions
7. If the user wants to review math, create "Review Math" sessions
8. DO NOT create generic sessions like "Review Physics Notes" unless user specifically asks for physics
9. Use 12-hour format with AM/PM
10. Fill each day with 3-6 study sessions (each session is 30 minutes)

IMPORTANT: Return ONLY valid JSON (no text, no markdown, no code fences, no explanations).
Only create study sessions that match the user's goals: "${studyGoals}"
`;

  try {
    console.log("📅 Generating study schedule...");
    console.log("📋 Class times:", classTimes);
    console.log("🎯 Study goals:", studyGoals);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    console.log("🤖 Gemini AI schedule response:", text.substring(0, 500));

    // Clean JSON (remove code fences if present)
    text = text.replace(/```json/g, "").replace(/```/g, "");

    let parsed;
    try {
      parsed = JSON.parse(text);
      console.log("✅ Parsed schedule:", JSON.stringify(parsed, null, 2).substring(0, 500));
    } catch (err) {
      console.error("❌ JSON Parse Error:", text);
      return res.status(500).json({ error: "AI response was not valid JSON" });
    }

    // DON'T merge classes - frontend will handle classes separately
    // Just return the AI-generated study sessions
    console.log("✅ Study schedule generated (classes NOT included):", JSON.stringify(parsed, null, 2).substring(0, 500));

    res.json(parsed);
  } catch (err) {
    console.error("❌ Schedule API error:", err);
    if (err.message?.includes("API_KEY")) {
      return res.status(500).json({ error: "Invalid or missing Gemini API key" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// =======================
// 📌 MCP Transport Setup
// =======================
const transports = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport;
  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport;
      },
    });
    await server.connect(transport);
  }
  await transport.handleRequest(req, res, req.body);
});

// =======================
// 📌 Start Server
// =======================
app.listen(3001, () => {
  console.log("✅ MCP + Scheduler server running at http://localhost:3001");
  console.log("➡️  Scheduler API: POST http://localhost:3001/schedule");
  console.log("➡️  MCP endpoint: POST http://localhost:3001/mcp");
});

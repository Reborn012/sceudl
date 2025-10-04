import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";
import multer from "multer";

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
// 📌 PDF Upload & Parse API (Direct to Gemini - Multimodal)
// =======================
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    console.log("📄 Uploading PDF directly to Gemini for multimodal processing...");
    console.log("📊 PDF file size:", req.file.size, "bytes");

    // Send PDF directly to Gemini using File API (multimodal)
    const prompt = `
You are analyzing a PDF image of a weekly university class schedule.

IMPORTANT: This is the ACTUAL VISUAL PDF - you can see the table structure directly.

YOUR TASK:
1. Look at the table columns - each column represents a day of the week
2. Read the column headers to identify which day is which (look for dates like Sep 29, Sep 30, Oct 1, etc. OR day names)
3. For each class in the schedule:
   - Identify which COLUMN it appears in to determine the DAY
   - Extract the course name/code
   - Extract the time (start - end)
   - Extract the location (building + room)

DATE TO DAY MAPPING (use if you see dates):
- Sep 29, 2025 = Monday
- Sep 30, 2025 = Tuesday
- Oct 1, 2025 = Wednesday
- Oct 2, 2025 = Thursday
- Oct 3, 2025 = Friday
- Oct 4, 2025 = Saturday
- Oct 5, 2025 = Sunday

Return ONLY valid JSON (NO markdown, NO code fences):
{
  "classTimes": [
    "Tue 9:30 AM - 10:45 AM - CS 3080 Lecture - Hayes Hall 117",
    "Thu 9:30 AM - 10:45 AM - CS 3080 Lecture - Hayes Hall 117"
  ],
  "courses": [
    {
      "name": "CS 3080 Lecture",
      "days": ["Tue", "Thu"],
      "time": "9:30 AM - 10:45 AM",
      "location": "Hayes Hall 117"
    }
  ],
  "confidence": "high"
}

CRITICAL FORMAT RULES:
1. Create a SEPARATE entry in classTimes for EACH occurrence of each class
2. MUST use this EXACT format: "Day HH:MM AM - HH:MM AM - Course Name - Location"
3. MUST have spaces around AM/PM (e.g., "9:30 AM" NOT "9:30AM")
4. MUST have space-dash-space between times (e.g., " - " NOT "-")
5. Look carefully at the visual table to determine which column (day) each class is in
`;

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp"
      });

      // Convert PDF buffer to base64 for Gemini
      const pdfBase64 = req.file.buffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: pdfBase64
          }
        },
        { text: prompt }
      ]);
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

        // Validate the parsed schedule
        if (!parsedSchedule.classTimes || !Array.isArray(parsedSchedule.classTimes)) {
          throw new Error("Missing or invalid classTimes array");
        }

        // Validation: Check if we got reasonable results
        if (parsedSchedule.classTimes.length === 0) {
          console.warn("⚠️  No class times detected. Confidence:", parsedSchedule.confidence || "unknown");

          // Try to rebuild classTimes from courses if empty
          if (parsedSchedule.courses && parsedSchedule.courses.length > 0) {
            console.log("🔄 Rebuilding classTimes from courses array...");
            parsedSchedule.classTimes = [];
            parsedSchedule.courses.forEach(course => {
              course.days.forEach(day => {
                parsedSchedule.classTimes.push(
                  `${day} ${course.time} - ${course.name} - ${course.location}`
                );
              });
            });
            console.log("✅ Rebuilt", parsedSchedule.classTimes.length, "class times from courses");
          }
        }

        // Additional validation: Ensure time format is correct
        parsedSchedule.classTimes = parsedSchedule.classTimes.map(classTime => {
          // Validate format: "Day HH:MM AM/PM - HH:MM AM/PM - Course - Location"
          const parts = classTime.split(" - ");
          if (parts.length < 2) {
            console.warn("⚠️  Malformed class time entry:", classTime);
          }
          return classTime;
        });

        console.log("✅ Validation passed. Found", parsedSchedule.classTimes.length, "class time entries");

      } catch (err) {
        console.error("❌ AI JSON Parse Error:", err.message);
        console.error("❌ Failed to parse:", aiResponse);

        return res.status(500).json({
          error: "AI could not parse schedule into valid format",
          aiResponse: aiResponse.substring(0, 500),
          suggestion: "Please check if the PDF contains a valid class schedule or try uploading it again"
        });
      }

      console.log("📤 Sending response to frontend...");
      res.json({
        success: true,
        schedule: parsedSchedule,
        extractionMethod: "gemini-multimodal-direct"
      });
      console.log("✅ Response sent successfully");
    } catch (aiError) {
      console.error("❌ Gemini AI Error:", aiError);
      return res.status(500).json({
        error: "Failed to process PDF with Gemini multimodal API: " + aiError.message,
        suggestion: "The PDF may be too large or in an incompatible format"
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

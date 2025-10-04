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
// 📌 Helper: Extract Table Structure from PDF
// =======================
async function extractPDFText(buffer) {
  console.log("🔍 Extracting PDF with column detection...");
  const pdfParser = new PDFParser();

  const extractedText = await new Promise((resolve, reject) => {
    pdfParser.on("pdfParser_dataError", (errData) => {
      reject(errData.parserError);
    });

    pdfParser.on("pdfParser_dataReady", (pdfData) => {
      let tableData = [];

      pdfData.Pages.forEach((page, pageNum) => {
        console.log(`📄 Analyzing page ${pageNum + 1} structure...`);

        // Collect all text with coordinates
        let items = [];
        page.Texts.forEach((textItem) => {
          textItem.R.forEach((r) => {
            items.push({
              text: decodeURIComponent(r.T),
              x: textItem.x,
              y: textItem.y
            });
          });
        });

        // Find column X positions (detect vertical alignment)
        let xPositions = {};
        items.forEach(item => {
          const roundedX = Math.round(item.x * 2) / 2; // Group by 0.5 units
          xPositions[roundedX] = (xPositions[roundedX] || 0) + 1;
        });

        // Find the most common X positions (likely column starts)
        const columns = Object.entries(xPositions)
          .filter(([x, count]) => count > 3)
          .map(([x]) => parseFloat(x))
          .sort((a, b) => a - b);

        console.log(`📊 Detected ${columns.length} columns at X positions:`, columns);

        // Group by rows (Y position)
        const rows = {};
        items.forEach(item => {
          const y = Math.round(item.y * 10) / 10;
          if (!rows[y]) rows[y] = [];
          rows[y].push(item);
        });

        // Build table structure
        const sortedYs = Object.keys(rows).map(Number).sort((a, b) => a - b);

        sortedYs.forEach(y => {
          const rowItems = rows[y].sort((a, b) => a.x - b.x);
          const rowData = {};

          // Assign items to columns
          rowItems.forEach(item => {
            // Find which column this belongs to
            let colIndex = columns.findIndex((colX, idx) => {
              const nextColX = columns[idx + 1] || Infinity;
              return item.x >= colX - 0.5 && item.x < nextColX;
            });

            if (colIndex === -1) colIndex = columns.length; // Beyond last column

            if (!rowData[colIndex]) rowData[colIndex] = "";
            rowData[colIndex] += item.text + " ";
          });

          tableData.push(rowData);
        });
      });

      // Convert table to text with clear column separation
      let formattedText = "=== SCHEDULE TABLE ===\n\n";
      tableData.forEach((row, idx) => {
        const cols = Object.keys(row).sort((a, b) => a - b);
        formattedText += cols.map(col => row[col].trim()).join(" | ") + "\n";
      });

      console.log("✅ Table extraction complete");
      console.log("📄 Formatted table:\n", formattedText.substring(0, 800));

      resolve(formattedText.trim());
    });

    pdfParser.parseBuffer(buffer);
  });

  return { text: extractedText, method: "column-detection" };
}

// =======================
// 📌 Helper: Robust Time/Date Parsing with Regex
// =======================
function preprocessScheduleText(text) {
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Common time patterns
  const timePatterns = [
    /\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)\b/g,
    /\b(\d{1,2}):(\d{2})\b/g,
  ];

  // Normalize times to consistent format
  text = text.replace(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/gi, (match, h, m, period) => {
    return `${h}:${m} ${period.toUpperCase()}`;
  });

  // Day abbreviations
  const dayPatterns = {
    'monday': 'Mon', 'mon': 'Mon', 'm': 'Mon',
    'tuesday': 'Tue', 'tue': 'Tue', 't': 'Tue',
    'wednesday': 'Wed', 'wed': 'Wed', 'w': 'Wed',
    'thursday': 'Thu', 'thu': 'Thu', 'th': 'Thu', 'r': 'Thu',
    'friday': 'Fri', 'fri': 'Fri', 'f': 'Fri',
    'saturday': 'Sat', 'sat': 'Sat', 's': 'Sat',
    'sunday': 'Sun', 'sun': 'Sun', 'su': 'Sun'
  };

  return text;
}

// =======================
// 📌 Helper: Regex Fallback Extraction
// =======================
function extractClassTimesWithRegex(text) {
  const classTimes = [];

  // Comprehensive regex patterns for common schedule formats
  const patterns = [
    // Pattern 1: "MWF 10:00 AM - 11:00 AM CS 101 Room 123"
    /([MTWRFSU]+|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s+([A-Z]+\s*\d+[A-Za-z]*)\s*(.*)/gi,

    // Pattern 2: "Monday 9:30AM-10:45AM CS3080 Hayes Hall 117"
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)\s+([A-Z]+\s*\d+[A-Za-z]*)\s*(.*)/gi,

    // Pattern 3: "CS 101 Mon/Wed/Fri 10:00-11:00 AM Building 123"
    /([A-Z]+\s*\d+[A-Za-z]*)\s+([MTWRFSU/]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*([AP]M)\s*(.*)/gi,
  ];

  const dayMap = {
    'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'F': 'Fri', 'S': 'Sat', 'U': 'Sun',
    'Mon': 'Mon', 'Tue': 'Tue', 'Wed': 'Wed', 'Thu': 'Thu', 'Fri': 'Fri', 'Sat': 'Sat', 'Sun': 'Sun',
    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed', 'Thursday': 'Thu',
    'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
  };

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        let days, startTime, endTime, course, location;

        if (match[1].length <= 7 && /[MTWRFSU]/.test(match[1])) {
          // Pattern 1: day abbreviations
          const dayChars = match[1].split('');
          days = dayChars.map(d => dayMap[d]).filter(Boolean);
          startTime = match[2];
          endTime = match[3];
          course = match[4];
          location = match[5] || 'TBD';
        } else if (match[1].includes('/')) {
          // Pattern 3: slash-separated days
          const dayParts = match[1].split('/');
          days = dayParts.map(d => dayMap[d.trim()]).filter(Boolean);
          course = match[0]; // Full match as course for now
          startTime = match[3];
          endTime = match[4];
          location = match[6] || 'TBD';
        } else {
          // Pattern 2: full day names
          days = [dayMap[match[1]]];
          startTime = match[2];
          endTime = match[3];
          course = match[4];
          location = match[5] || 'TBD';
        }

        // Create entry for each day
        days.forEach(day => {
          if (day) {
            classTimes.push(`${day} ${startTime} - ${endTime} - ${course.trim()} - ${location.trim()}`);
          }
        });
      } catch (err) {
        console.error("Regex extraction error:", err);
      }
    }
  });

  return classTimes;
}

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

CRITICAL: Create a SEPARATE entry in classTimes for EACH occurrence of each class.
Look carefully at the visual table to determine which column (day) each class is in.
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

        // Fallback: Try to extract any time patterns from raw text using regex
        console.log("🔄 Attempting fallback regex extraction...");
        const fallbackClassTimes = extractClassTimesWithRegex(extractedText);

        if (fallbackClassTimes.length > 0) {
          console.log("✅ Fallback extraction found", fallbackClassTimes.length, "entries");
          return res.json({
            success: true,
            schedule: {
              classTimes: fallbackClassTimes,
              courses: [],
              confidence: "low",
              method: "regex-fallback"
            },
            rawText: extractedText.substring(0, 500),
            warning: "AI parsing failed. Using basic regex extraction."
          });
        }

        return res.status(500).json({
          error: "AI could not parse schedule into valid format",
          rawText: extractedText.substring(0, 1000),
          aiResponse: aiResponse.substring(0, 500),
          suggestion: "Please check if the PDF contains a valid class schedule"
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

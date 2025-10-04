import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";
import multer from "multer";
import { google } from "googleapis";

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

// Google Calendar OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/oauth2callback"
);

// Store user tokens by session (in production, use a database)
// This allows multiple users to authenticate independently
const userTokensMap = new Map();

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
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:3000", "http://localhost:3004", "http://localhost:3005", "http://localhost:3006"] }));
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
  const { classTimes, studyGoals, intensity = 2 } = req.body;

  // Intensity-based session limits - TOTAL across the entire week
  const intensityConfig = {
    1: { totalSessions: 3, description: "minimal (3 sessions total for the week)" },
    2: { totalSessions: 5, description: "light (5 sessions total for the week)" },
    3: { totalSessions: 8, description: "moderate (8 sessions total for the week)" },
    4: { totalSessions: 12, description: "active (12 sessions total for the week)" },
    5: { totalSessions: 15, description: "intense (15+ sessions total for the week)" }
  };

  const config = intensityConfig[intensity] || intensityConfig[2];

  const prompt = `
Create a study schedule for a university student.

USER'S STUDY GOALS: "${studyGoals}"
CLASSES TO AVOID: ${classTimes.join(", ")}
INTENSITY LEVEL: ${intensity}/5

CRITICAL: Create EXACTLY ${config.totalSessions} study sessions TOTAL for the ENTIRE WEEK (Monday-Sunday).
NOT ${config.totalSessions} per day - ${config.totalSessions} TOTAL across all 7 days INCLUDING WEEKENDS!

TASK DIVISION:
- If ONE task given: Split into ${config.totalSessions} sessions across the week
- If MULTIPLE tasks given: Divide ${config.totalSessions} sessions between them

REQUIREMENTS:
1. EXACTLY ${config.totalSessions} sessions TOTAL for the entire week
2. Each session: 60-120 minutes (e.g., 67min, 85min, 103min, 118min)
3. Times: Between 6:00 AM and 11:00 PM (can use early morning and night hours)
4. NO 30-minute blocks - all sessions must be 60+ minutes
5. Spread sessions across ALL 7 days (Monday through Sunday) - USE WEEKENDS!
6. Look for EMPTY GAPS in the schedule and fill them intelligently
7. Avoid class times
8. MUST include Saturday and Sunday in the schedule

CRITICAL - AVOID REPETITION:
❌ DON'T repeat the same task multiple times (e.g., "Review Math Notes" 4 times)
✅ Instead, break into SPECIFIC sub-tasks:
   - "Review Math Notes - Chapter 3 Derivatives"
   - "Practice Math Problems - Integration Techniques"
   - "Math Problem Set - Solve Homework Questions 1-10"
   - "Review Math Exam - Go Through Practice Test"

EXAMPLE (Intensity 1 - 3 sessions total for entire week):
INPUT: "physics exam"
OUTPUT:
{
  "Monday": {},
  "Tuesday": {
    "10:15 AM - 12:03 PM": "Physics Exam Prep - Review Chapters 1-4"
  },
  "Wednesday": {},
  "Thursday": {},
  "Friday": {
    "2:30 PM - 4:22 PM": "Physics Exam Prep - Practice Problems & Solutions"
  },
  "Saturday": {
    "9:00 AM - 10:47 AM": "Physics Exam Prep - Formula Review & Past Exams"
  },
  "Sunday": {}
}

EXAMPLE (Intensity 3 - 8 sessions spread across week including weekends):
INPUT: "coding, math"
OUTPUT:
{
  "Monday": {
    "7:00 AM - 8:45 AM": "Coding Practice - Data Structures Review"
  },
  "Tuesday": {
    "6:30 PM - 8:12 PM": "Math Study - Calculus Chapter 1"
  },
  "Wednesday": {
    "8:00 PM - 9:38 PM": "Coding Practice - Algorithm Problems"
  },
  "Thursday": {},
  "Friday": {
    "3:00 PM - 4:52 PM": "Math Study - Practice Problem Sets"
  },
  "Saturday": {
    "10:00 AM - 11:47 AM": "Coding Practice - LeetCode Medium Problems",
    "2:00 PM - 3:33 PM": "Math Study - Review Class Notes"
  },
  "Sunday": {
    "11:00 AM - 12:45 PM": "Coding Practice - Build Mini Project",
    "7:00 PM - 8:28 PM": "Math Study - Prepare for Quiz"
  }
}

CRITICAL FINAL CHECK:
- Count ALL sessions across Monday through Sunday (ALL 7 DAYS)
- The total count MUST equal ${config.totalSessions}
- If you have more than ${config.totalSessions} sessions, remove some
- If you have less than ${config.totalSessions} sessions, add more
- MUST include Saturday and Sunday in the JSON output even if empty

Return ONLY valid JSON. NO markdown, NO code fences, NO explanations.
YOU MUST CREATE EXACTLY ${config.totalSessions} SESSIONS TOTAL - NOT MORE, NOT LESS!
SPREAD THEM ACROSS THE ENTIRE WEEK INCLUDING WEEKENDS!
`;

  try {
    console.log("📅 Generating study schedule...");
    console.log("📋 Class times:", classTimes);
    console.log("🎯 Study goals:", studyGoals);
    console.log("💪 Intensity level:", intensity, `(${config.totalSessions} sessions TOTAL for the week)`);

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

    // Validate session count
    let totalSessions = 0;
    Object.keys(parsed).forEach(day => {
      totalSessions += Object.keys(parsed[day]).length;
    });

    console.log(`📊 Total sessions generated: ${totalSessions} (expected: ${config.totalSessions})`);

    // If AI generated too many sessions, remove excess
    if (totalSessions > config.totalSessions) {
      console.log(`⚠️ Too many sessions! Removing ${totalSessions - config.totalSessions} sessions...`);
      let removed = 0;
      const daysToRemove = totalSessions - config.totalSessions;

      for (const day of Object.keys(parsed)) {
        if (removed >= daysToRemove) break;
        const times = Object.keys(parsed[day]);
        while (times.length > 0 && removed < daysToRemove) {
          const lastTime = times.pop();
          delete parsed[day][lastTime];
          removed++;
        }
      }

      totalSessions = config.totalSessions;
      console.log(`✅ Trimmed to ${totalSessions} sessions`);
    }

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
// 📌 AI Chat Assistant
// =======================
app.post("/ai-chat", async (req, res) => {
  const { message, currentSchedule } = req.body;

  const prompt = `
You are an intelligent schedule assistant. The user has the following schedule:

${JSON.stringify(currentSchedule, null, 2)}

User request: "${message}"

TASK: Understand the user's request and respond conversationally. If they want to modify the schedule, provide the COMPLETE updated schedule with ALL existing events PLUS your changes.

CRITICAL: You MUST return the ENTIRE updated schedule array including ALL existing events. Never remove existing events unless specifically asked.

RESPONSE FORMAT:
{
  "response": "Your conversational response to the user",
  "action": "add" | "remove" | "update" | "none",
  "updatedSchedule": [...] // FULL schedule with ALL existing events + your modifications
}

SCHEDULE EVENT STRUCTURE:
{
  "id": number,
  "title": string,
  "startTime": "HH:MM" (24-hour format),
  "endTime": "HH:MM" (24-hour format),
  "day": number (1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday, 7=Saturday),
  "color": "blue" | "indigo" | "purple" | "cyan" | "green" | "orange" | "pink" | "teal",
  "description": string,
  "location": string,
  "attendees": [],
  "organizer": string
}

EXAMPLES:
1. "Add a study session for math on Tuesday at 2pm"
   → action: "add", return ALL existing events PLUS new math study event at Tuesday 14:00

2. "Remove all events on Friday"
   → action: "remove", return ALL existing events EXCEPT those on Friday (day === 6)

3. "Move my CS 3080 class to Thursday"
   → action: "update", return ALL existing events with CS 3080 day changed to 5

4. "What's on my schedule tomorrow?"
   → action: "none", just respond conversationally (no updatedSchedule needed)

Return ONLY valid JSON. No markdown, no code fences.
`;

  try {
    console.log("🤖 AI Chat request:", message);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log("📝 AI Response:", text.substring(0, 200));

    // Clean and parse response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (error) {
    console.error("❌ AI Chat error:", error);
    res.status(500).json({
      response: "I'm having trouble understanding that request. Could you rephrase it?",
      action: "none"
    });
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
// 📌 Google Calendar OAuth Routes
// =======================

// Step 1: Get authorization URL
app.get("/google-auth-url", (req, res) => {
  // Generate a session ID for this user
  const sessionId = randomUUID();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar"],
    prompt: "consent",
    state: sessionId // Pass session ID to track this user
  });

  res.json({ authUrl, sessionId });
});

// Step 2: OAuth callback
app.get("/oauth2callback", async (req, res) => {
  const { code, state: sessionId } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens for this specific user session
    userTokensMap.set(sessionId, tokens);

    console.log(`✅ Google Calendar authenticated for session: ${sessionId}`);
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>✅ Google Calendar Connected!</h2>
          <p>You can now sync your events with Google Calendar.</p>
          <p>You can close this window and return to the app.</p>
          <script>
            window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', sessionId: '${sessionId}' }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ OAuth error:", error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ Authentication Failed</h2>
          <p>Error: ${error.message}</p>
          <p>Please make sure you added the correct redirect URI to your Google Cloud Console:</p>
          <code>http://localhost:3001/oauth2callback</code>
        </body>
      </html>
    `);
  }
});

// Check auth status
app.get("/google-auth-status", (req, res) => {
  const sessionId = req.query.sessionId;

  if (!sessionId) {
    return res.json({ authenticated: false });
  }

  const tokens = userTokensMap.get(sessionId);
  res.json({
    authenticated: !!tokens?.access_token,
    hasRefreshToken: !!tokens?.refresh_token
  });
});

// =======================
// 📌 Google Calendar Sync
// =======================

app.post("/sync-to-google-calendar", async (req, res) => {
  const { events, sessionId } = req.body;

  if (!sessionId) {
    return res.status(401).json({
      error: "No session ID provided",
      requiresAuth: true
    });
  }

  const userTokens = userTokensMap.get(sessionId);

  if (!userTokens?.access_token) {
    return res.status(401).json({
      error: "Not authenticated with Google Calendar",
      requiresAuth: true
    });
  }

  try {
    // Create a new OAuth client for this user
    const userOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    userOAuth.setCredentials(userTokens);

    const calendar = google.calendar({ version: "v3", auth: userOAuth });

    // Map day numbers to actual dates (week of March 3-9, 2025)
    const dayToDate = {
      1: "2025-03-09", // Sunday
      2: "2025-03-03", // Monday
      3: "2025-03-04", // Tuesday
      4: "2025-03-05", // Wednesday
      5: "2025-03-06", // Thursday
      6: "2025-03-07", // Friday
      7: "2025-03-08"  // Saturday
    };

    const createdEvents = [];
    const errors = [];

    for (const event of events) {
      try {
        const date = dayToDate[event.day];
        const [startHour, startMin] = event.startTime.split(":");
        const [endHour, endMin] = event.endTime.split(":");

        const googleEvent = {
          summary: event.title,
          description: event.description || "",
          location: event.location || "",
          start: {
            dateTime: `${date}T${event.startTime}:00`,
            timeZone: "America/New_York"
          },
          end: {
            dateTime: `${date}T${event.endTime}:00`,
            timeZone: "America/New_York"
          },
          colorId: getGoogleCalendarColorId(event.color)
        };

        const result = await calendar.events.insert({
          calendarId: "primary",
          resource: googleEvent
        });

        createdEvents.push({
          id: event.id,
          googleEventId: result.data.id,
          title: event.title
        });

        console.log(`✅ Synced: ${event.title}`);
      } catch (err) {
        console.error(`❌ Failed to sync ${event.title}:`, err.message);
        errors.push({ eventId: event.id, error: err.message });
      }
    }

    res.json({
      success: true,
      synced: createdEvents.length,
      total: events.length,
      events: createdEvents,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Google Calendar sync error:", error);
    res.status(500).json({
      error: "Failed to sync with Google Calendar",
      details: error.message
    });
  }
});

// Helper function to map app colors to Google Calendar color IDs
function getGoogleCalendarColorId(color) {
  const colorMap = {
    blue: "1",      // Lavender
    indigo: "9",    // Blue
    purple: "3",    // Purple
    cyan: "7",      // Cyan
    green: "2",     // Sage
    orange: "6",    // Orange
    pink: "4",      // Flamingo
    teal: "10",     // Basil
    red: "11",      // Tomato
    yellow: "5"     // Banana
  };
  return colorMap[color] || "1";
}

// =======================
// 📌 Start Server
// =======================
app.listen(3001, () => {
  console.log("✅ MCP + Scheduler server running at http://localhost:3001");
  console.log("➡️  Scheduler API: POST http://localhost:3001/schedule");
  console.log("➡️  MCP endpoint: POST http://localhost:3001/mcp");
  console.log("➡️  Google Calendar Auth: GET http://localhost:3001/google-auth-url");
  console.log("➡️  Google Calendar Sync: POST http://localhost:3001/sync-to-google-calendar");
});

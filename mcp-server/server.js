import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import dotenv from "dotenv";

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

// ✅ Allow frontend (Next.js on port 3001 and Vite on port 5173) to call backend
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:3001", "http://localhost:3000"] }));
app.use(express.json());

// =======================
// 📌 Study Schedule API
// =======================
app.post("/schedule", async (req, res) => {
  const { classTimes, studyGoals } = req.body;

  const prompt = `
Generate a weekly study schedule as JSON with this schema:
{
  "Monday": {
    "07:30 - 08:30": "",
    "08:30 - 09:30": "",
    "09:30 - 10:30": "",
    "10:30 - 11:30": "",
    "11:30 - 12:30": "",
    "12:30 - 13:30": "",
    "13:30 - 14:30": "",
    "14:30 - 15:30": "",
    "15:30 - 16:30": ""
  },
  "Tuesday": { ... },
  "Wednesday": { ... },
  "Thursday": { ... },
  "Friday": { ... }
}

Class times: ${classTimes}
Study goals: ${studyGoals}

IMPORTANT: Return ONLY valid JSON (no text, no markdown, no explanations).
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Clean JSON (remove code fences if present)
    text = text.replace(/```json/g, "").replace(/```/g, "");

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON Parse Error:", text);
      return res.status(500).json({ error: "AI response was not valid JSON" });
    }

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
app.listen(3000, () => {
  console.log("✅ MCP + Scheduler server running at http://localhost:3000");
  console.log("➡️  Scheduler API: POST http://localhost:3000/schedule");
  console.log("➡️  MCP endpoint: POST http://localhost:3000/mcp");
});

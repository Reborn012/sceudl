// Import MCP server class from the SDK
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Import WebSocket server for real-time communication
import { WebSocketServer } from "ws";
// Import Google Generative AI SDK (for Gemini tool)
import { GoogleGenerativeAI } from "@google/generative-ai";
// Import Zod for input validation
import { z } from "zod";

// Create Gemini AI instance using your API key from environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const server = new McpServer({
  name: "demo-server",
  version: "1.0.0"
});

// Local registry to store tool handler functions
const toolHandlers = {};

// In-memory storage for todos and notes
const todos = [];
const notes = {};

// Register schedule.generate tool
server.registerTool(
  "schedule.generate",
  {
    title: "Schedule Generator",
    description: "Generates a study schedule based on class times and study goals",
    inputSchema: {
      classTimes: z.array(z.string()),
      studyGoals: z.string()
    }
  },
  async ({ classTimes, studyGoals }) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = `
      You are an AI scheduler. Here are my class times:
      ${classTimes.join(", ")}

      My study goals are:
      ${studyGoals}

      Please generate a balanced weekly study schedule.
      - Avoid class time conflicts
      - Spread goals across the week
      - Output as a day-by-day plan
    `;
    const result = await model.generateContent(prompt);
    return { content: [{ type: "text", text: result.response.text() }] };
  }
);
toolHandlers["schedule.generate"] = async (input) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const prompt = `
    You are an AI scheduler. Here are my class times:
    ${input.classTimes.join(", ")}

    My study goals are:
    ${input.studyGoals}

    Please generate a balanced weekly study schedule.
    - Avoid class time conflicts
    - Spread goals across the week
    - Output as a day-by-day plan
  `;
  const result = await model.generateContent(prompt);
  return { content: [{ type: "text", text: result.response.text() }] };
};

// Register todo.add tool
server.registerTool(
  "todo.add",
  {
    title: "Add Todo",
    description: "Add a new todo item",
    inputSchema: { task: z.string() }
  },
  async ({ task }) => {
    todos.push(task);
    return { content: [{ type: "text", text: `Added todo: ${task}` }] };
  }
);
toolHandlers["todo.add"] = async (input) => {
  todos.push(input.task);
  return { content: [{ type: "text", text: `Added todo: ${input.task}` }] };
};

// Register todo.list tool
server.registerTool(
  "todo.list",
  {
    title: "List Todos",
    description: "List all todo items",
    inputSchema: {}
  },
  async () => {
    return { content: [{ type: "text", text: todos.length ? todos.join('\n') : "No todos yet." }] };
  }
);
toolHandlers["todo.list"] = async () => {
  return { content: [{ type: "text", text: todos.length ? todos.join('\n') : "No todos yet." }] };
};

// Register note.save tool
server.registerTool(
  "note.save",
  {
    title: "Save Note",
    description: "Save a note by key",
    inputSchema: { key: z.string(), text: z.string() }
  },
  async ({ key, text }) => {
    notes[key] = text;
    return { content: [{ type: "text", text: `Saved note for key: ${key}` }] };
  }
);
toolHandlers["note.save"] = async (input) => {
  notes[input.key] = input.text;
  return { content: [{ type: "text", text: `Saved note for key: ${input.key}` }] };
};

// Register note.get tool
server.registerTool(
  "note.get",
  {
    title: "Get Note",
    description: "Retrieve a note by key",
    inputSchema: { key: z.string() }
  },
  async ({ key }) => {
    const text = notes[key] || "Note not found.";
    return { content: [{ type: "text", text }] };
  }
);
toolHandlers["note.get"] = async (input) => {
  const text = notes[input.key] || "Note not found.";
  return { content: [{ type: "text", text }] };
};

// Register a tool called "hello.world" that returns a greeting message
server.registerTool(
  "hello.world",
  {
    title: "Hello World Tool", // Display name for the tool
    description: "Returns a hello world message", // Description for documentation
    inputSchema: { name: z.string() } // Input validation: expects a string called 'name'
  },
  async ({ name }) => {
    // The handler returns a greeting message using the input name
    return { content: [{ type: "text", text: `Hello, ${name}! Your MCP server is working.` }] };
  }
);

// Store the handler in the local registry for direct access
toolHandlers["hello.world"] = async (input) => {
  return { content: [{ type: "text", text: `Hello, ${input.name}! Your MCP server is working.` }] };
};

// Register a tool called "gemini.ask" that queries Gemini AI
server.registerTool(
  "gemini.ask",
  {
    title: "Gemini Ask Tool", // Display name for the tool
    description: "Ask Gemini a question via API", // Description for documentation
    inputSchema: { prompt: z.string() } // Input validation: expects a string called 'prompt'
  },
  async ({ prompt }) => {
    // The handler sends the prompt to Gemini AI and returns the response
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    return { content: [{ type: "text", text: result.response.text() }] };
  }
);

// Store the handler in the local registry for direct access
toolHandlers["gemini.ask"] = async (input) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent(input.prompt);
  return { content: [{ type: "text", text: result.response.text() }] };
};

// Create a WebSocket server on port 3000
const wss = new WebSocketServer({ port: 3000 });

// Listen for client connections
wss.on("connection", async (ws) => {
  // Listen for messages from the client
  ws.on("message", async (message) => {
    try {
      // Convert message to string and parse JSON
      const msgStr = typeof message === "string" ? message : message.toString();
      console.log("Received message:", msgStr);
      const req = JSON.parse(msgStr);

      // If the client requests a tool execution
      if (req.method === "tool.execute" && req.params.name) {
        // Find the tool handler and execute it
        if (toolHandlers[req.params.name]) {
          try {
            const result = await toolHandlers[req.params.name](req.params.input);
            // Send the result back to the client
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }));
          } catch (err) {
            // Send error if tool execution fails
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: err.message } }));
          }
        } else {
          // Send error if tool is not found
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Tool not found" } }));
        }
      } else {
        // Send error if method is not supported
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "Method not found" } }));
      }
    } catch (err) {
      // Send error if message parsing fails
      ws.send(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }));
    }
  });
});

// Log that the server is running
console.log("✅ MCP WebSocket server is running on ws://localhost:3000");

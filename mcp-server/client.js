import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const ws = new WebSocket("ws://localhost:3000"); // adjust port if needed

ws.on("open", () => {
  console.log("Connected to MCP server ✅");

  // Change this variable to test different tools:
  const toolToTest = "schedule.generate"; // Options: "hello.world", "gemini.ask", "todo.add", "todo.list", "note.save", "note.get", "schedule.generate"

  let request;
  switch (toolToTest) {
    case "hello.world":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "hello.world",
          input: { name: "Rudrashis" }
        }
      };
      break;
    case "gemini.ask":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "gemini.ask",
          input: { prompt: "What is the capital of France?" }
        }
      };
      break;
    case "todo.add":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "todo.add",
          input: { task: "Finish math homework" }
        }
      };
      break;
    case "todo.list":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "todo.list",
          input: {}
        }
      };
      break;
    case "note.save":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "note.save",
          input: { key: "math", text: "Study chapter 5" }
        }
      };
      break;
    case "note.get":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "note.get",
          input: { key: "math" }
        }
      };
      break;
    case "schedule.generate":
      request = {
        jsonrpc: "2.0",
        id: uuidv4(),
        method: "tool.execute",
        params: {
          name: "schedule.generate",
          input: {
            classTimes: ["Mon 9am-11am", "Wed 2pm-4pm"],
            studyGoals: "Finish math homework, Read history chapter"
          }
        }
      };
      break;
    default:
      console.log("Unknown tool");
      return;
  }

  ws.send(JSON.stringify(request));
});

ws.on("message", (data) => {
  console.log("📩 Response:", data.toString());
});
ws.on("close", () => {
  console.log("Disconnected from MCP server ❌");
});


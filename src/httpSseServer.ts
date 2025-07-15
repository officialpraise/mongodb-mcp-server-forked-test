import express, { Request, Response } from "express";
import { Server } from "./server.js";
import { config } from "./config.js";
import { createEJsonTransport } from "./helpers/EJsonTransport.js";

const app = express();
app.use(express.json());


const sseClients: Set<Response> = new Set();


app.get("/sse", (req: Request, res: Response) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.flushHeaders();
  sseClients.add(res);

  // Per MCP spec: send endpoint event
  res.write(`event: endpoint\ndata: ${JSON.stringify({ endpoint: "/messages" })}\n\n`);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// POST endpoint for client messages
app.post("/messages", async (req: Request, res: Response) => {
  const message = req.body;
  // TODO: Forward message to MCP server logic and get response
  // For now, just echo and broadcast to all SSE clients
  for (const client of sseClients) {
    client.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
  }
  res.status(200).json({ status: "ok" });
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`MCP HTTP/SSE server running on http://127.0.0.1:${PORT}`);
}); 
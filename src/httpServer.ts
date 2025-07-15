// src/httpServer.ts
// @ts-ignore: No type declarations for this deep import, but the file exists and is required for HTTP/SSE transport
import { McpServer } from "@modelcontextprotocol/sdk/dist/esm/server/mcp";
// @ts-ignore: No type declarations for this deep import, but the file exists and is required for HTTP/SSE transport
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/dist/esm/server/streamableHttp";
import { config } from "./config.js";
import { Session } from "./session.js";
import { packageInfo } from "./helpers/packageInfo.js";
import { Telemetry } from "./telemetry/telemetry.js";
import { Server } from "./server.js";

async function main() {
  const session = new Session({
    apiBaseUrl: config.apiBaseUrl,
    apiClientId: config.apiClientId,
    apiClientSecret: config.apiClientSecret,
  });

  const mcpServer = new McpServer({
    name: packageInfo.mcpServerName,
    version: packageInfo.version,
  });

  const telemetry = Telemetry.create(session, config);

  const server = new Server({
    mcpServer,
    session,
    telemetry,
    userConfig: config,
  });

  // Register tools/resources (no transport argument)
  await server.connect();

  // Use the port from the environment variable or default to 8080
  const port = parseInt(process.env.PORT || "8080", 10);
  const transport = new StreamableHTTPServerTransport({ port });
  await mcpServer.connect(transport);

  console.log(`MCP HTTP server listening on port ${port}`);

  const closeServer = async () => {
    console.log("Closing server...");
    await transport.close();
    process.exit(0);
  };

  process.on("SIGINT", closeServer);
  process.on("SIGTERM", closeServer);
}

main().catch((err) => {
  console.error("Failed to start HTTP server:", err);
  process.exit(1);
});
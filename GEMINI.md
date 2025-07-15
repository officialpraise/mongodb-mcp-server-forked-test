# Updated Guide: Adding HTTP/SSE Support to Your MCP Server for Remote Hosting and Claude Desktop

This guide provides a comprehensive, step-by-step implementation for enabling HTTP/SSE (Server-Sent Events) support in your Model Context Protocol (MCP) server. By following these steps, you can host your server on a platform like Render and connect to it remotely from Claude Desktop or any other MCP-compatible client.

---

## Table of Contents
1. [Background & Requirements](#background--requirements)
2. [Install Required Package](#install-required-package)
3. [Create HTTP Entry Point](#create-http-entry-point)
4. [Update package.json Scripts](#update-packagejson-scripts)
5. [Environment Variables & Connection String](#environment-variables--connection-string)
6. [Deploying to Render](#deploying-to-render)
7. [Configuring Claude Desktop](#configuring-claude-desktop)
8. [Testing & Troubleshooting](#testing--troubleshooting)
9. [Security & Best Practices](#security--best-practices)
10. [References](#references)

---

## 1. Background & Requirements

- **Current State:** Your server likely uses the standard I/O (stdio) transport, which is suitable only for local processes.
- **Goal:** To make the server accessible over the internet, we will add an HTTP transport. This allows remote clients like Claude Desktop to connect to your server via a URL.
- **Key Library:** We will use the official `@modelcontextprotocol/sdk` which contains all the necessary tools to create and manage MCP servers and transports.
- **Port Handling:** Hosting platforms like Render dynamically assign a port via the `process.env.PORT` environment variable. Our server must listen on this port.
- **Database Connection:** Your server should already be configured to accept a MongoDB connection string through environment variables or command-line arguments.

---

## 2. Install Required Package

The primary package you need is the MCP SDK. It includes the server core and various transport options.

```sh
npm install @modelcontextprotocol/sdk
```

---

## 3. Create HTTP Entry Point

Create a new file in your project, for example, at `src/httpServer.ts`. This file will initialize your server and attach an HTTP transport to it.

```ts
// src/httpServer.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpTransport } from "@modelcontextprotocol/sdk/server/transports/http.js";
import { config } from "./config.js"; // Your existing config import
import { Session } from "./session.js"; // Your existing session import
import { packageInfo } from "./helpers/packageInfo.js"; // Your existing packageInfo import
import { Telemetry } from "./telemetry/telemetry.js"; // Your existing telemetry import
import { Server } from "./server.js"; // Your main server logic

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

  // Your main server class that registers tools and resources
  const server = new Server({
    mcpServer,
    session,
    telemetry,
    userConfig: config,
  });

  // The connect method should handle tool and resource registration.
  // It no longer needs a transport, as that is handled separately.
  await server.connect();

  // Use the port from the environment variable provided by Render, or default to 8080 for local dev
  const port = parseInt(process.env.PORT || "8080", 10);

  // Create and connect the HTTP transport
  const transport = new HttpTransport({ port });
  await mcpServer.connect(transport);

  console.log(`MCP HTTP server listening on port ${port}`);

  // Graceful shutdown logic
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
```

**Note:**
- You may need to refactor your `Server` class slightly. The `server.connect()` method should focus on registering your tools and resources with the `mcpServer` instance, rather than handling transport logic. The transport is now managed separately in this entry point file.

---

## 4. Update `package.json` Scripts

Add a new script to your `package.json` to run the HTTP server. This will be the command Render uses to start your service.

If you are using `ts-node` for development:

```json
"scripts": {
  "start": "node dist/stdioServer.js", // Your existing stdio start command
  "start:http": "ts-node src/httpServer.ts",
  "build": "tsc" // Or your existing build command
}
```

If you are running from a compiled `dist/` directory (recommended for production):

```json
"scripts": {
  "start": "node dist/stdioServer.js",
  "start:http": "node dist/httpServer.js",
  "build": "tsc"
}
```

---

## 5. Environment Variables & Connection String

Your hosting environment needs to be configured with the necessary secrets and settings.

### A. MongoDB Connection String
Set `MDB_MCP_CONNECTION_STRING` in your Render service’s environment variables.

### B. Port
You do **not** need to set the `PORT` variable. Render automatically provides it to your application.

### C. Example Render Environment Variables

| Key                       | Value                                                    |
|---------------------------|----------------------------------------------------------|
| MDB_MCP_CONNECTION_STRING | mongodb+srv://user:pass@cluster.mongodb.net/dbName       |
| MDB_MCP_API_CLIENT_ID     | (Your Atlas App Services Client ID, if used)             |
| MDB_MCP_API_CLIENT_SECRET | (Your Atlas App Services Client Secret, if used)         |

---

## 6. Deploying to Render

1. **Push Code:** Ensure your latest code, including `httpServer.ts` and the updated `package.json`, is pushed to your GitHub/GitLab repository.
2. **Create New Web Service:** In the Render dashboard, create a new "Web Service".
3. **Connect Repo:** Connect the repository containing your server code.
4. **Configure Service:**
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:http`
   - **Environment Variables:** Add the secrets from the table above.
5. **Deploy:** Click "Create Web Service" to start the deployment.
6. **Get URL:** Once deployed, Render will provide a public URL for your service (e.g., `https://your-mcp-server.onrender.com`).

---

## 7. Configuring Claude Desktop

To connect Claude Desktop to your newly deployed server, edit your `claude_desktop_config.json` file.

```json
{
  "mcpServers": {
    "mongodb": {
      "transport": "sse",
      "url": "https://your-mcp-server.onrender.com"
    }
  }
}
```

- Replace `https://your-mcp-server.onrender.com` with the actual URL from your Render service.
- The `"transport": "sse"` key tells Claude Desktop how to communicate with the server at that URL.
- Restart Claude Desktop for the configuration changes to take effect.

---

## 8. Testing & Troubleshooting

- **Test Locally:** Run `npm run start:http` in your terminal. You can then test the connection by using curl or by pointing your local Claude Desktop config to `http://localhost:8080`.
- **Check Render Logs:** If you encounter issues, the first place to look is the "Logs" tab for your service in the Render dashboard. This will show you server startup messages, connection errors, and any runtime exceptions.
- **Verify Endpoint:** You can visit your Render URL in a web browser. While an MCP server endpoint may not show visible content, you should not get a "Not Found" error from Render's proxy. You might see a simple message like "OK" or a hanging connection, which is normal.

---

## 9. Security & Best Practices

- **Secrets Management:** Always use environment variables for secrets like database credentials and API keys. Never hardcode them in your source code.
- **Authentication:** For production or public-facing servers, consider implementing an authentication layer. You can add a simple API key check within your HTTP transport logic.
- **CORS:** The `@modelcontextprotocol/sdk` HTTP transport handles basic Cross-Origin Resource Sharing (CORS) settings. If you need more complex rules, you may need to extend the transport or use a proxy.
- **Health Check Endpoint:** Render automatically monitors if your service is running on the assigned port. You can optionally add a `/health` endpoint for more specific health checks.

---

## 10. References

- [MCP SDK on npm: @modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [Render Docs on Environment Variables](https://render.com/docs/environment-variables)
- [Render Docs for Node.js](https://render.com/docs/deploy-nodejs)

---

By following this updated guide, your MCP server will be correctly configured for remote access, allowing seamless integration with Claude Desktop and other clients. 
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerResources } from "./resources.js";
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";

const server = new McpServer({
  name: "agents-config",
  version: "0.1.0",
});

registerResources(server);
registerTools(server);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("agents-config MCP server running");

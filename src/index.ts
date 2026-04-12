import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WorkspaceManager } from './workspace-manager.js';
import { DocumentManager } from './document-manager.js';
import { registerDefinitionTool } from './tools/definition.js';
import { registerReferencesTool } from './tools/references.js';
import { registerHoverTool } from './tools/hover.js';

const server = new McpServer({
  name: 'tsmcp-lsp',
  version: '0.1.0',
});

const workspaceManager = new WorkspaceManager();
const documentManager = new DocumentManager();

// Register MCP tools
registerDefinitionTool(server, workspaceManager, documentManager);
registerReferencesTool(server, workspaceManager, documentManager);
registerHoverTool(server, workspaceManager, documentManager);

// Graceful shutdown
async function shutdown() {
  await workspaceManager.shutdownAll();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

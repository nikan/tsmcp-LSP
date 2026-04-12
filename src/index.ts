import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'tsmcp-lsp',
  version: '0.1.0',
});

// TODO: Register MCP tools (ts_definition, ts_references, ts_hover, ts_symbols)
// Tool registration is deferred to the tools epic; this stub validates the build.

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

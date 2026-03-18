#!/usr/bin/env node
/**
 * BlockchainQuery MCP — Server Entry Point
 *
 * Initialises the MCP server, registers all 32 tools from the handler files,
 * connects via stdio transport, and wires up graceful shutdown.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registry } from './services/chain-registry.js';

// Import all handler registration functions
import { registerTools as registerDiscoveryTools } from './handlers/discovery-handlers.js';
import { registerTools as registerEvmTools } from './handlers/evm-handlers.js';
import { registerTools as registerSolanaTools } from './handlers/solana-handlers.js';
import { registerTools as registerCosmosTools } from './handlers/cosmos-handlers.js';
import { registerTools as registerSuiTools } from './handlers/sui-handlers.js';
import { registerTools as registerNearTools } from './handlers/near-handlers.js';
import { registerTools as registerCrossChainTools } from './handlers/cross-chain-handlers.js';

// ---------------------------------------------------------------------------
// Server instantiation
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'blockchain-query', version: '2.0.0' },
  { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const allTools = [
  ...registerDiscoveryTools(),
  ...registerEvmTools(),
  ...registerSolanaTools(),
  ...registerCosmosTools(),
  ...registerSuiTools(),
  ...registerNearTools(),
  ...registerCrossChainTools(),
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: allTools.map((t) => ({
    name: t.definition.name,
    description: t.definition.description,
    inputSchema: t.definition.inputSchema,
  })),
}));

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean; [key: string]: unknown }> => {
  const { name, arguments: args } = request.params;
  const tool = allTools.find((t) => t.definition.name === name);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    return await tool.handler(args ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Initialize chain registry (loads bundled JSON, fires liveness probes)
  await registry.init();

  // Connect via stdio — stdout is reserved for MCP protocol messages
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so as not to pollute the MCP protocol stream
  console.error('BlockchainQuery MCP server started');
  console.error(`Registered ${allTools.length} tools`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

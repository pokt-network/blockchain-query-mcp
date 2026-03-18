/**
 * BlockchainQuery MCP — Discovery Tool Handlers
 *
 * Provides two tools for chain discovery:
 *   - list_chains:    enumerate all supported chains, with optional protocol/network filter
 *   - get_chain_info: detailed information about a single chain by slug
 */

import { registry } from '../services/chain-registry.js';
import { getProtocolDefinition, getRegisteredProtocols } from '../protocols/method-registry.js';
import { postCheck } from '../utils/safety-checks.js';
import type { ToolResponse } from '../types/index.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResponse>;

export interface RegisteredToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function ok(data: unknown): ToolResponse {
  const { data: checked, truncated } = postCheck(data);
  const payload = truncated
    ? { ...(checked as object), _note: 'Response was truncated due to size limits' }
    : checked;
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function err(message: string): ToolResponse {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ---------------------------------------------------------------------------
// Tool: list_chains
// ---------------------------------------------------------------------------

const LIST_CHAINS_DEFINITION: ToolDefinition = {
  name: 'list_chains',
  description: [
    'List all blockchain networks supported by this server.',
    'Use this tool when a user asks "what chains are available?", "which networks support EVM?",',
    'or "show me all testnets". Optionally filter by protocol (e.g. "evm", "solana", "cosmos",',
    '"sui", "near") or by network type ("mainnet" or "testnet").',
    'Returns an array of chain objects, each containing: name, slug (the identifier to pass to',
    'other tools), protocol, network, and status.',
    'Limitation: status reflects a cached liveness probe; actual endpoint availability may differ.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      protocol: {
        type: 'string',
        description:
          'Filter by protocol family. One of: ' + getRegisteredProtocols().join(', ') + '.',
      },
      network: {
        type: 'string',
        enum: ['mainnet', 'testnet'],
        description: 'Filter by network type: "mainnet" or "testnet".',
      },
    },
    required: [],
  },
};

async function listChainsHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const protocol = typeof args['protocol'] === 'string' ? args['protocol'] : undefined;
  const network =
    args['network'] === 'mainnet' || args['network'] === 'testnet' ? args['network'] : undefined;

  const chains = registry.listChains({ protocol, network });

  // Attach runtime status to each entry so the caller gets a single complete view
  const result = chains.map((c) => ({
    name: c.name,
    slug: c.slug,
    protocol: c.protocol,
    network: c.network,
    evm_compatible: c.evm_compatible ?? false,
    status: registry.getStatus(c.slug),
    notes: c.notes ?? null,
  }));

  return ok({ chains: result, total: result.length });
}

// ---------------------------------------------------------------------------
// Tool: get_chain_info
// ---------------------------------------------------------------------------

const GET_CHAIN_INFO_DEFINITION: ToolDefinition = {
  name: 'get_chain_info',
  description: [
    'Get detailed information about a specific blockchain network.',
    'Use this when a user asks "tell me about Ethereum", "what methods does Polygon support?",',
    'or "what is the status of the Solana mainnet endpoint?".',
    'The `chain` parameter must be a slug returned by list_chains (e.g. "eth", "polygon",',
    '"solana", "cosmos-hub").',
    'Returns: chain metadata, supported RPC methods, and current endpoint status.',
    'Limitation: method list reflects the protocol-level definition; individual chain endpoints',
    'may support a subset of these methods.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description:
          'The chain slug to look up (e.g. "eth", "polygon", "solana"). Use list_chains to discover valid slugs.',
      },
    },
    required: ['chain'],
  },
};

async function getChainInfoHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const slug = typeof args['chain'] === 'string' ? args['chain'].trim() : '';
  if (!slug) {
    return err('Missing required parameter: chain');
  }

  const chain = registry.getChain(slug);
  if (!chain) {
    return err(
      `Unknown chain: '${slug}'. Use list_chains to see all available chain slugs.`,
    );
  }

  // Attempt to load protocol method definitions
  let supportedMethods: string[] = [];
  try {
    const protoDef = getProtocolDefinition(chain.protocol);
    supportedMethods = protoDef.methods.map((m) => m.name);
  } catch {
    // Protocol not in registry — leave methods empty
  }

  const status = registry.getStatus(slug);

  const result = {
    name: chain.name,
    slug: chain.slug,
    protocol: chain.protocol,
    network: chain.network,
    evm_compatible: chain.evm_compatible ?? false,
    status,
    notes: chain.notes ?? null,
    supported_methods: supportedMethods,
    endpoint_url: chain.url,
  };

  return ok(result);
}

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export function registerTools(): RegisteredToolEntry[] {
  return [
    { definition: LIST_CHAINS_DEFINITION, handler: listChainsHandler },
    { definition: GET_CHAIN_INFO_DEFINITION, handler: getChainInfoHandler },
  ];
}

/**
 * BlockchainQuery MCP — Solana Handlers
 *
 * Registers MCP tool definitions and their handlers for Solana queries.
 */

import { solanaService } from '../services/solana-service.js';
import { postCheck } from '../utils/safety-checks.js';

// ---------------------------------------------------------------------------
// Types
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
) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

function formatResponse(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): { content: Array<{ type: 'text'; text: string }>; isError?: boolean } {
  if (!result.success) {
    return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
  }
  const { data, truncated } = postCheck(result.data);
  const text = JSON.stringify(
    truncated ? { ...(data as object), _note: 'Response truncated' } : data,
    null,
    2,
  );
  return { content: [{ type: 'text', text }] };
}

// ---------------------------------------------------------------------------
// Tool registrations
// ---------------------------------------------------------------------------

export function registerTools(): Array<{ definition: ToolDefinition; handler: ToolHandler }> {
  return [
    // ------------------------------------------------------------------
    // solana_get_balance
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'solana_get_balance',
        description:
          'Get SOL balance for a Solana address. Optionally pass a mint_address for SPL token balance. Returns lamports and SOL.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The Solana wallet or account address (base-58 encoded public key).',
            },
            mint_address: {
              type: 'string',
              description:
                'Optional SPL token mint address. When supplied, returns SPL token accounts instead of native SOL.',
            },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = args['address'] as string;
        const mintAddress = args['mint_address'] as string | undefined;
        const result = await solanaService.getBalance(address, mintAddress);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // solana_get_account
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'solana_get_account',
        description:
          'Get Solana account information including owner, lamports, and data encoding.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The Solana account address (base-58 encoded public key).',
            },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = args['address'] as string;
        const result = await solanaService.getAccount(address);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // solana_get_block
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'solana_get_block',
        description:
          'Get Solana block details by slot number. Returns block hash, transactions (signatures only), and rewards.',
        inputSchema: {
          type: 'object',
          properties: {
            slot: {
              type: 'number',
              description: 'The slot number of the block to retrieve.',
            },
          },
          required: ['slot'],
        },
      },
      handler: async (args) => {
        const slot = args['slot'] as number;
        const result = await solanaService.getBlock(slot);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // solana_get_transaction
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'solana_get_transaction',
        description: 'Get Solana transaction details by signature hash.',
        inputSchema: {
          type: 'object',
          properties: {
            signature: {
              type: 'string',
              description: 'The transaction signature (base-58 encoded).',
            },
          },
          required: ['signature'],
        },
      },
      handler: async (args) => {
        const signature = args['signature'] as string;
        const result = await solanaService.getTransaction(signature);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // solana_get_signatures
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'solana_get_signatures',
        description:
          'Get recent transaction signatures for a Solana address. Default limit: 10.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The Solana address to query signatures for.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of signatures to return (default: 10).',
              default: 10,
            },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = args['address'] as string;
        const limit = args['limit'] !== undefined ? (args['limit'] as number) : 10;
        const result = await solanaService.getSignatures(address, limit);
        return formatResponse(result);
      },
    },
  ];
}

/**
 * BlockchainQuery MCP — Sui Handlers
 *
 * Registers MCP tool definitions and their handlers for Sui blockchain queries.
 */

import { suiService } from '../services/sui-service.js';
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
    // sui_get_balance
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'sui_get_balance',
        description:
          'Get SUI or specific token balance for a Sui address. Defaults to native SUI.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The Sui address (hex-encoded with 0x prefix).',
            },
            coin_type: {
              type: 'string',
              description:
                'Optional fully-qualified coin type (e.g. 0x2::sui::SUI). Defaults to native SUI when omitted.',
            },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = args['address'] as string;
        const coinType = args['coin_type'] as string | undefined;
        const result = await suiService.getBalance(address, coinType);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // sui_get_object
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'sui_get_object',
        description:
          'Get Sui object details by ID including type, owner, and content.',
        inputSchema: {
          type: 'object',
          properties: {
            object_id: {
              type: 'string',
              description: 'The Sui object ID (hex-encoded with 0x prefix).',
            },
          },
          required: ['object_id'],
        },
      },
      handler: async (args) => {
        const objectId = args['object_id'] as string;
        const result = await suiService.getObject(objectId);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // sui_get_transaction
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'sui_get_transaction',
        description: 'Get Sui transaction details by digest hash.',
        inputSchema: {
          type: 'object',
          properties: {
            digest: {
              type: 'string',
              description: 'The Sui transaction digest (base-58 encoded).',
            },
          },
          required: ['digest'],
        },
      },
      handler: async (args) => {
        const digest = args['digest'] as string;
        const result = await suiService.getTransaction(digest);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // sui_get_coins
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'sui_get_coins',
        description: 'Get coin details with pagination for a Sui address.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'The Sui address to retrieve coins for.',
            },
            coin_type: {
              type: 'string',
              description:
                'Optional fully-qualified coin type to filter by. Returns all coin types when omitted.',
            },
            cursor: {
              type: 'string',
              description:
                'Optional pagination cursor from a previous response to fetch the next page.',
            },
            limit: {
              type: 'number',
              description: 'Optional maximum number of coin objects to return per page.',
            },
          },
          required: ['address'],
        },
      },
      handler: async (args) => {
        const address = args['address'] as string;
        const coinType = args['coin_type'] as string | undefined;
        const cursor = args['cursor'] as string | undefined;
        const limit = args['limit'] as number | undefined;
        const result = await suiService.getCoins(address, coinType, cursor, limit);
        return formatResponse(result);
      },
    },
  ];
}

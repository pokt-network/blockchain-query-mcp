/**
 * BlockchainQuery MCP — Radix Handlers
 *
 * Registers MCP tool definitions and their handlers for Radix Gateway API queries.
 */

import { radixService } from '../services/radix-service.js';
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
    // radix_get_network_status
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'radix_get_network_status',
        description:
          'Get Radix network status including current state version, epoch, round, and timestamp.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const result = await radixService.getNetworkStatus();
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // radix_get_network_config
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'radix_get_network_config',
        description:
          'Get Radix network configuration including version info and well-known addresses.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const result = await radixService.getNetworkConfig();
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // radix_get_balance
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'radix_get_balance',
        description:
          'Get all fungible token balances for a Radix account address.',
        inputSchema: {
          type: 'object',
          properties: {
            account_address: {
              type: 'string',
              description:
                'The Radix account address (e.g. "account_rdx...").',
            },
          },
          required: ['account_address'],
        },
      },
      handler: async (args) => {
        const accountAddress = args['account_address'] as string;
        const result = await radixService.getBalance(accountAddress);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // radix_get_transaction_status
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'radix_get_transaction_status',
        description:
          'Get the status of a Radix transaction by its intent hash.',
        inputSchema: {
          type: 'object',
          properties: {
            intent_hash: {
              type: 'string',
              description:
                'The transaction intent hash to look up.',
            },
          },
          required: ['intent_hash'],
        },
      },
      handler: async (args) => {
        const intentHash = args['intent_hash'] as string;
        const result = await radixService.getTransactionStatus(intentHash);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // radix_get_consensus_manager
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'radix_get_consensus_manager',
        description:
          'Get Radix consensus manager state including validator set and epoch information.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      handler: async () => {
        const result = await radixService.getConsensusManager();
        return formatResponse(result);
      },
    },
  ];
}

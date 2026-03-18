/**
 * BlockchainQuery MCP — Cosmos Handlers
 *
 * Registers MCP tool definitions and their handlers for Cosmos SDK chain queries.
 */

import { cosmosService } from '../services/cosmos-service.js';
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
    // cosmos_get_balance
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_balance',
        description:
          "Get native or all token balances on any Cosmos SDK chain. Pass chain slug (e.g. 'osmosis', 'pocket', 'akash'). Optionally filter by denom.",
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description:
                "Chain slug identifying the Cosmos network (e.g. 'osmosis', 'pocket', 'akash', 'cosmos').",
            },
            address: {
              type: 'string',
              description: 'The bech32-encoded account address.',
            },
            denom: {
              type: 'string',
              description:
                'Optional denomination to filter by (e.g. uosmo, uatom). Omit to return all balances.',
            },
          },
          required: ['chain', 'address'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const address = args['address'] as string;
        const denom = args['denom'] as string | undefined;
        const result = await cosmosService.getBalance(chain, address, denom);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // cosmos_get_staking
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_staking',
        description:
          'Get staking delegations and rewards for a delegator on any Cosmos chain.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chain slug identifying the Cosmos network.',
            },
            delegator_address: {
              type: 'string',
              description: 'The bech32-encoded delegator address.',
            },
          },
          required: ['chain', 'delegator_address'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const delegatorAddress = args['delegator_address'] as string;
        const result = await cosmosService.getStaking(chain, delegatorAddress);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // cosmos_get_validators
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_validators',
        description:
          'Get validator list or specific validator details on any Cosmos chain.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chain slug identifying the Cosmos network.',
            },
            validator_address: {
              type: 'string',
              description:
                'Optional bech32-encoded validator operator address. Omit to return all validators.',
            },
          },
          required: ['chain'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const validatorAddress = args['validator_address'] as string | undefined;
        const result = await cosmosService.getValidators(chain, validatorAddress);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // cosmos_get_transaction
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_transaction',
        description: 'Get transaction details by hash on any Cosmos chain.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chain slug identifying the Cosmos network.',
            },
            tx_hash: {
              type: 'string',
              description: 'The uppercase hex transaction hash.',
            },
          },
          required: ['chain', 'tx_hash'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const txHash = args['tx_hash'] as string;
        const result = await cosmosService.getTransaction(chain, txHash);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // cosmos_get_governance
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_governance',
        description:
          'Get governance proposals on any Cosmos chain. Optionally pass proposal_id for specific proposal details.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chain slug identifying the Cosmos network.',
            },
            proposal_id: {
              type: 'string',
              description:
                'Optional proposal ID (numeric string). Omit to return all proposals.',
            },
          },
          required: ['chain'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const proposalId = args['proposal_id'] as string | undefined;
        const result = await cosmosService.getGovernance(chain, proposalId);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // cosmos_get_block
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'cosmos_get_block',
        description: 'Get block by height or latest block on any Cosmos chain.',
        inputSchema: {
          type: 'object',
          properties: {
            chain: {
              type: 'string',
              description: 'Chain slug identifying the Cosmos network.',
            },
            height: {
              type: 'string',
              description:
                'Optional block height as a string (e.g. "12345678"). Omit to retrieve the latest block.',
            },
          },
          required: ['chain'],
        },
      },
      handler: async (args) => {
        const chain = args['chain'] as string;
        const height = args['height'] as string | undefined;
        const result = await cosmosService.getBlock(chain, height);
        return formatResponse(result);
      },
    },
  ];
}

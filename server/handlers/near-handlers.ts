/**
 * BlockchainQuery MCP — Near Handlers
 *
 * Registers MCP tool definitions and their handlers for NEAR Protocol queries.
 */

import { nearService } from '../services/near-service.js';
import { preCheck, postCheck } from '../utils/safety-checks.js';

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
    // near_query
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'near_query',
        description:
          'Query Near Protocol state: account info, view function calls, access keys, contract state, or contract code. Use request_type to specify the query kind.',
        inputSchema: {
          type: 'object',
          properties: {
            request_type: {
              type: 'string',
              enum: [
                'view_account',
                'call_function',
                'view_access_key_list',
                'view_state',
                'view_code',
              ],
              description:
                'The kind of NEAR query to perform. One of: view_account, call_function, view_access_key_list, view_state, view_code.',
            },
            account_id: {
              type: 'string',
              description: 'The NEAR account ID to query (e.g. "example.near").',
            },
            method_name: {
              type: 'string',
              description:
                'Contract view method to call. Required when request_type is call_function.',
            },
            args_base64: {
              type: 'string',
              description:
                'Base64-encoded JSON arguments for the view function call. Used with request_type call_function.',
            },
            prefix_base64: {
              type: 'string',
              description:
                'Base64-encoded key prefix for state queries. Required when request_type is view_state.',
            },
          },
          required: ['request_type', 'account_id'],
        },
      },
      handler: async (args) => {
        const requestType = args['request_type'] as string;
        const accountId = args['account_id'] as string;
        const methodName = args['method_name'] as string | undefined;
        const argsBase64 = args['args_base64'] as string | undefined;
        const prefixBase64 = args['prefix_base64'] as string | undefined;

        // Build the query params object with only defined fields
        const queryParams: Record<string, unknown> = { account_id: accountId };
        if (methodName !== undefined) queryParams['method_name'] = methodName;
        if (argsBase64 !== undefined) queryParams['args_base64'] = argsBase64;
        if (prefixBase64 !== undefined) queryParams['prefix_base64'] = prefixBase64;

        // Apply preCheck for Near safety (call_function args size, view_state prefix)
        const safetyResult = preCheck('query', [
          { request_type: requestType, ...queryParams },
        ]);
        if (!safetyResult.allowed) {
          return {
            content: [{ type: 'text', text: `Error: ${safetyResult.reason}` }],
            isError: true,
          };
        }

        const result = await nearService.query(requestType, queryParams);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // near_get_block
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'near_get_block',
        description:
          'Get Near block by height (number), hash (string), or latest (omit block_id).',
        inputSchema: {
          type: 'object',
          properties: {
            block_id: {
              description:
                'Optional block identifier. Pass a number for block height, a string for block hash. Omit to retrieve the latest finalized block.',
              oneOf: [{ type: 'number' }, { type: 'string' }],
            },
          },
        },
      },
      handler: async (args) => {
        const blockId = args['block_id'] as number | string | undefined;
        const result = await nearService.getBlock(blockId);
        return formatResponse(result);
      },
    },

    // ------------------------------------------------------------------
    // near_get_transaction
    // ------------------------------------------------------------------
    {
      definition: {
        name: 'near_get_transaction',
        description:
          'Get Near transaction status and receipts by hash. Requires sender account ID.',
        inputSchema: {
          type: 'object',
          properties: {
            tx_hash: {
              type: 'string',
              description: 'The NEAR transaction hash (base-58 encoded).',
            },
            sender_account_id: {
              type: 'string',
              description:
                'The NEAR account ID of the transaction sender (e.g. "sender.near").',
            },
          },
          required: ['tx_hash', 'sender_account_id'],
        },
      },
      handler: async (args) => {
        const txHash = args['tx_hash'] as string;
        const senderAccountId = args['sender_account_id'] as string;
        const result = await nearService.getTransaction(txHash, senderAccountId);
        return formatResponse(result);
      },
    },
  ];
}

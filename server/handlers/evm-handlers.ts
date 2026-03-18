/**
 * BlockchainQuery MCP — EVM Tool Handlers
 *
 * Nine tools covering the most common EVM read operations:
 *   evm_call            — generic JSON-RPC dispatch
 *   evm_get_balance     — native coin balance
 *   evm_get_block       — block by number or hash
 *   evm_get_transaction — transaction by hash
 *   evm_get_receipt     — transaction receipt
 *   evm_get_logs        — event logs with filter
 *   evm_estimate_gas    — gas estimate
 *   evm_get_token_info  — ERC-20 token metadata
 *   evm_call_contract   — arbitrary read-only contract call
 */

import { evmService } from '../services/evm-service.js';
import { preCheck, postCheck } from '../utils/safety-checks.js';
import type { RpcResponse, ToolResponse } from '../types/index.js';
import type { RegisteredToolEntry, ToolDefinition, ToolHandler } from './discovery-handlers.js';

// Re-export the shared types for consumers who import from this module
export type { RegisteredToolEntry, ToolDefinition, ToolHandler };

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function formatResponse(result: RpcResponse): ToolResponse {
  if (!result.success) {
    return {
      content: [{ type: 'text', text: `Error: ${result.error ?? 'Unknown error'}` }],
      isError: true,
    };
  }

  const { data: checked, truncated } = postCheck(result.data);
  const payload = truncated
    ? { ...(checked as object), _note: 'Response was truncated due to size limits' }
    : checked;

  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function err(message: string): ToolResponse {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

function requireString(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

// ---------------------------------------------------------------------------
// Tool: evm_call
// ---------------------------------------------------------------------------

const EVM_CALL_DEFINITION: ToolDefinition = {
  name: 'evm_call',
  description: [
    'Send a raw JSON-RPC method call to any EVM-compatible chain.',
    'Use this for methods not covered by the dedicated tools, e.g. "what is the gas price on',
    'Polygon?", "call eth_blockNumber on BNB Chain", or "what chain ID does Ethereum use?".',
    'The `chain` slug must be an EVM-compatible network (use list_chains to find valid slugs).',
    'The `method` must be a valid JSON-RPC method name (e.g. "eth_gasPrice", "net_version").',
    'Blocked methods: debug_traceTransaction, debug_traceCall, debug_storageRangeAt, trace_block.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc"). Use list_chains to discover options.',
      },
      method: {
        type: 'string',
        description: 'JSON-RPC method name (e.g. "eth_gasPrice", "eth_chainId", "net_version").',
      },
      params: {
        type: 'array',
        description: 'Array of method parameters. Omit or pass [] for zero-argument methods.',
        items: {},
      },
    },
    required: ['chain', 'method'],
  },
};

async function evmCallHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const method = requireString(args, 'method');

  if (!chain) return err('Missing required parameter: chain');
  if (!method) return err('Missing required parameter: method');

  const params = Array.isArray(args['params']) ? args['params'] : [];

  // Safety pre-check
  const safety = preCheck(method, params);
  if (!safety.allowed) {
    return err(safety.reason ?? 'Request blocked by safety check.');
  }

  const result = await evmService.genericCall(chain, method, params);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_balance
// ---------------------------------------------------------------------------

const EVM_GET_BALANCE_DEFINITION: ToolDefinition = {
  name: 'evm_get_balance',
  description: [
    'Get the native coin balance for an address on an EVM-compatible chain.',
    'Use this when a user asks "what is the ETH balance of 0xabc…?", "how much MATIC does',
    'this wallet hold?", or "check my balance on BNB Chain".',
    'The `chain` slug must be EVM-compatible. Returns both the raw hex value, the decimal',
    'amount, and the display unit (e.g. ETH, MATIC, BNB).',
    'Limitation: returns the native coin balance only; for ERC-20 token balances use evm_get_token_info.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      address: {
        type: 'string',
        description: 'Ethereum-style address (0x-prefixed, 40 hex chars).',
      },
    },
    required: ['chain', 'address'],
  },
};

async function evmGetBalanceHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const address = requireString(args, 'address');

  if (!chain) return err('Missing required parameter: chain');
  if (!address) return err('Missing required parameter: address');

  const result = await evmService.getBalance(chain, address);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_block
// ---------------------------------------------------------------------------

const EVM_GET_BLOCK_DEFINITION: ToolDefinition = {
  name: 'evm_get_block',
  description: [
    'Fetch a block from an EVM-compatible chain by block number, tag, or hash.',
    'Use this when asked "show me the latest block on Ethereum", "get block 19000000 on Polygon",',
    'or "look up block 0xabc…def on BNB Chain".',
    'Accepts any block tag: "latest", "earliest", "pending", a decimal number (as string),',
    'a hex number ("0x123abc"), or a full 66-character block hash.',
    'Returns block header information without full transaction objects to keep responses manageable.',
    'Limitation: full transaction bodies are excluded; use evm_get_transaction for individual txs.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      block_id: {
        type: 'string',
        description:
          'Block identifier: "latest", "earliest", "pending", a decimal number as string, a hex number, or a 66-char block hash. Defaults to "latest".',
      },
    },
    required: ['chain'],
  },
};

async function evmGetBlockHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  if (!chain) return err('Missing required parameter: chain');

  const blockId =
    typeof args['block_id'] === 'string' && args['block_id'].trim() !== ''
      ? args['block_id'].trim()
      : 'latest';

  const result = await evmService.getBlock(chain, blockId);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_transaction
// ---------------------------------------------------------------------------

const EVM_GET_TRANSACTION_DEFINITION: ToolDefinition = {
  name: 'evm_get_transaction',
  description: [
    'Fetch a transaction by its hash from an EVM-compatible chain.',
    'Use this when a user asks "look up transaction 0xabc…", "what did this tx on Ethereum do?",',
    'or "find the details of this transaction hash on Polygon".',
    'Returns the full transaction object including: from, to, value, gas, input data, and status.',
    'Limitation: does not decode ABI-encoded input data — use evm_call_contract to simulate calls.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      tx_hash: {
        type: 'string',
        description: '66-character 0x-prefixed transaction hash.',
      },
    },
    required: ['chain', 'tx_hash'],
  },
};

async function evmGetTransactionHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const txHash = requireString(args, 'tx_hash');

  if (!chain) return err('Missing required parameter: chain');
  if (!txHash) return err('Missing required parameter: tx_hash');

  const result = await evmService.getTransaction(chain, txHash);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_receipt
// ---------------------------------------------------------------------------

const EVM_GET_RECEIPT_DEFINITION: ToolDefinition = {
  name: 'evm_get_receipt',
  description: [
    'Fetch a transaction receipt by hash from an EVM-compatible chain.',
    'Use this when a user asks "did this transaction succeed?", "what events were emitted by tx',
    '0xabc…?", or "how much gas was used by this transaction on BNB Chain?".',
    'Returns: status (1=success, 0=failure), gas used, block details, and emitted event logs.',
    'Limitation: log data is returned as raw hex; ABI decoding is not performed.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      tx_hash: {
        type: 'string',
        description: '66-character 0x-prefixed transaction hash.',
      },
    },
    required: ['chain', 'tx_hash'],
  },
};

async function evmGetReceiptHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const txHash = requireString(args, 'tx_hash');

  if (!chain) return err('Missing required parameter: chain');
  if (!txHash) return err('Missing required parameter: tx_hash');

  const result = await evmService.getReceipt(chain, txHash);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_logs
// ---------------------------------------------------------------------------

const EVM_GET_LOGS_DEFINITION: ToolDefinition = {
  name: 'evm_get_logs',
  description: [
    'Fetch event logs from an EVM-compatible chain using a filter.',
    'Use this when asked "show me Transfer events from contract 0xabc…", "what logs were emitted',
    'between blocks 19000000 and 19000005 by this contract?", or "find ERC-20 Transfer events".',
    'At least one of `address` or `topics` is required to prevent unbounded queries.',
    'Block range is limited to 10 blocks maximum when explicit hex block numbers are given.',
    'Provide block numbers as hex strings (e.g. "0x1234abc") or use "latest" / "earliest" tags.',
    'Limitation: maximum block range of 10; log data returned as raw hex without ABI decoding.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      from_block: {
        type: 'string',
        description: 'Starting block: hex string (e.g. "0x1234abc"), "latest", or "earliest".',
      },
      to_block: {
        type: 'string',
        description: 'Ending block: hex string (e.g. "0x1234abc"), "latest", or "earliest".',
      },
      address: {
        type: 'string',
        description: 'Contract address to filter logs by (0x-prefixed). Optional if topics is provided.',
      },
      topics: {
        type: 'array',
        description:
          'Array of topic filters (32-byte hex strings or null). Required if address is not provided.',
        items: {
          type: ['string', 'null'],
        },
      },
    },
    required: ['chain', 'from_block', 'to_block'],
  },
};

async function evmGetLogsHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const fromBlock = requireString(args, 'from_block');
  const toBlock = requireString(args, 'to_block');

  if (!chain) return err('Missing required parameter: chain');
  if (!fromBlock) return err('Missing required parameter: from_block');
  if (!toBlock) return err('Missing required parameter: to_block');

  // Build the eth_getLogs filter object
  const filter: Record<string, unknown> = {
    fromBlock,
    toBlock,
  };

  const address = requireString(args, 'address');
  if (address) filter['address'] = address;

  if (Array.isArray(args['topics'])) {
    filter['topics'] = args['topics'];
  }

  // Safety pre-check — validates range and requires at least address or topics
  const safety = preCheck('eth_getLogs', [filter]);
  if (!safety.allowed) {
    return err(safety.reason ?? 'Request blocked by safety check.');
  }

  const result = await evmService.getLogs(chain, filter);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_estimate_gas
// ---------------------------------------------------------------------------

const EVM_ESTIMATE_GAS_DEFINITION: ToolDefinition = {
  name: 'evm_estimate_gas',
  description: [
    'Estimate the gas cost of a transaction on an EVM-compatible chain.',
    'Use this when asked "how much gas would this transaction cost on Ethereum?",',
    '"estimate gas for sending ETH to this address", or "what is the gas for calling this contract?".',
    'The `to` address is required. `from`, `value` (in hex wei), and `data` (hex-encoded calldata)',
    'are optional. Returns the estimated gas units as a hex string.',
    'Limitation: this is an estimate; actual gas may differ. Does not account for priority fees.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      to: {
        type: 'string',
        description: 'Recipient address (0x-prefixed, required).',
      },
      from: {
        type: 'string',
        description: 'Sender address (0x-prefixed, optional but recommended for accuracy).',
      },
      value: {
        type: 'string',
        description: 'Value to send in hex wei (e.g. "0xde0b6b3a7640000" for 1 ETH). Optional.',
      },
      data: {
        type: 'string',
        description: 'ABI-encoded calldata as a hex string (0x-prefixed). Optional.',
      },
    },
    required: ['chain', 'to'],
  },
};

async function evmEstimateGasHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const to = requireString(args, 'to');

  if (!chain) return err('Missing required parameter: chain');
  if (!to) return err('Missing required parameter: to');

  const txObj: Record<string, string> = { to };

  const from = requireString(args, 'from');
  if (from) txObj['from'] = from;

  const value = requireString(args, 'value');
  if (value) txObj['value'] = value;

  const data = requireString(args, 'data');
  if (data) txObj['data'] = data;

  const result = await evmService.estimateGas(chain, txObj);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_get_token_info
// ---------------------------------------------------------------------------

const EVM_GET_TOKEN_INFO_DEFINITION: ToolDefinition = {
  name: 'evm_get_token_info',
  description: [
    'Fetch ERC-20 token metadata from a contract on an EVM-compatible chain.',
    'Use this when asked "what token is at contract 0xabc…?", "what are the decimals of USDC on',
    'Ethereum?", "what is the total supply of this token?", or "what is my USDT balance?".',
    'Always returns: name, symbol, decimals, totalSupply.',
    'If `wallet_address` is provided, also returns the wallet\'s token balance.',
    'Limitation: works only for standard ERC-20 contracts. Non-standard tokens may return nulls.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      token_address: {
        type: 'string',
        description: 'ERC-20 token contract address (0x-prefixed, 40 hex chars).',
      },
      wallet_address: {
        type: 'string',
        description:
          'Optional wallet address to query token balance for (0x-prefixed, 40 hex chars).',
      },
    },
    required: ['chain', 'token_address'],
  },
};

async function evmGetTokenInfoHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const tokenAddress = requireString(args, 'token_address');

  if (!chain) return err('Missing required parameter: chain');
  if (!tokenAddress) return err('Missing required parameter: token_address');

  const walletAddress = requireString(args, 'wallet_address') ?? undefined;

  const result = await evmService.getTokenInfo(chain, tokenAddress, walletAddress);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Tool: evm_call_contract
// ---------------------------------------------------------------------------

const EVM_CALL_CONTRACT_DEFINITION: ToolDefinition = {
  name: 'evm_call_contract',
  description: [
    'Execute a read-only (eth_call) smart contract call on an EVM-compatible chain.',
    'Use this when asked "call the ownerOf function on this NFT contract", "read a storage slot',
    'from a contract", or "query a custom view function using raw calldata".',
    'The `to` address is the contract and `data` is the ABI-encoded calldata (4-byte selector',
    'followed by encoded arguments), e.g. "0x70a08231" + padded address for balanceOf.',
    'Returns the raw hex-encoded return value. For ERC-20 metadata, prefer evm_get_token_info.',
    'Limitation: returns raw hex only; caller must decode the return value manually.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      chain: {
        type: 'string',
        description: 'EVM chain slug (e.g. "eth", "polygon", "bsc").',
      },
      to: {
        type: 'string',
        description: 'Contract address to call (0x-prefixed, 40 hex chars).',
      },
      data: {
        type: 'string',
        description: 'ABI-encoded calldata as a hex string (0x-prefixed). Include the 4-byte function selector.',
      },
    },
    required: ['chain', 'to', 'data'],
  },
};

async function evmCallContractHandler(args: Record<string, unknown>): Promise<ToolResponse> {
  const chain = requireString(args, 'chain');
  const to = requireString(args, 'to');
  const data = requireString(args, 'data');

  if (!chain) return err('Missing required parameter: chain');
  if (!to) return err('Missing required parameter: to');
  if (!data) return err('Missing required parameter: data');

  const result = await evmService.callContract(chain, to, data);
  return formatResponse(result);
}

// ---------------------------------------------------------------------------
// Registry export
// ---------------------------------------------------------------------------

export function registerTools(): RegisteredToolEntry[] {
  return [
    { definition: EVM_CALL_DEFINITION, handler: evmCallHandler },
    { definition: EVM_GET_BALANCE_DEFINITION, handler: evmGetBalanceHandler },
    { definition: EVM_GET_BLOCK_DEFINITION, handler: evmGetBlockHandler },
    { definition: EVM_GET_TRANSACTION_DEFINITION, handler: evmGetTransactionHandler },
    { definition: EVM_GET_RECEIPT_DEFINITION, handler: evmGetReceiptHandler },
    { definition: EVM_GET_LOGS_DEFINITION, handler: evmGetLogsHandler },
    { definition: EVM_ESTIMATE_GAS_DEFINITION, handler: evmEstimateGasHandler },
    { definition: EVM_GET_TOKEN_INFO_DEFINITION, handler: evmGetTokenInfoHandler },
    { definition: EVM_CALL_CONTRACT_DEFINITION, handler: evmCallContractHandler },
  ];
}

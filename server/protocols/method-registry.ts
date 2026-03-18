/**
 * BlockchainQuery MCP — Protocol Method Registry
 * Maps each blockchain protocol to its supported RPC methods and dispatch type.
 */

import type { ProtocolDefinition, MethodDefinition } from '../types/index.js';

const evmMethods: MethodDefinition[] = [
  { name: 'eth_blockNumber', params: [], description: 'Get current block number' },
  { name: 'eth_getBalance', params: [{ name: 'address', type: 'string', description: 'Account address', required: true }, { name: 'block', type: 'string', description: 'Block number or tag', required: false, default: 'latest' }], description: 'Get account balance' },
  { name: 'eth_getBlockByNumber', params: [{ name: 'blockNumber', type: 'string', description: 'Block number or tag', required: true }, { name: 'fullTx', type: 'boolean', description: 'Include full transactions', required: false, default: false }], description: 'Get block by number' },
  { name: 'eth_getBlockByHash', params: [{ name: 'blockHash', type: 'string', description: 'Block hash', required: true }, { name: 'fullTx', type: 'boolean', description: 'Include full transactions', required: false, default: false }], description: 'Get block by hash' },
  { name: 'eth_getTransactionByHash', params: [{ name: 'txHash', type: 'string', description: 'Transaction hash', required: true }], description: 'Get transaction by hash' },
  { name: 'eth_getTransactionReceipt', params: [{ name: 'txHash', type: 'string', description: 'Transaction hash', required: true }], description: 'Get transaction receipt' },
  { name: 'eth_getLogs', params: [{ name: 'filter', type: 'object', description: 'Log filter object', required: true }], description: 'Get event logs' },
  { name: 'eth_estimateGas', params: [{ name: 'txObject', type: 'object', description: 'Transaction object', required: true }], description: 'Estimate gas for transaction' },
  { name: 'eth_call', params: [{ name: 'txObject', type: 'object', description: 'Call object', required: true }, { name: 'block', type: 'string', description: 'Block number or tag', required: false, default: 'latest' }], description: 'Execute read-only contract call' },
  { name: 'eth_chainId', params: [], description: 'Get chain ID' },
  { name: 'eth_gasPrice', params: [], description: 'Get current gas price' },
  { name: 'net_version', params: [], description: 'Get network version' },
];

const solanaMethods: MethodDefinition[] = [
  { name: 'getBalance', params: [{ name: 'pubkey', type: 'string', description: 'Account public key', required: true }], description: 'Get SOL balance' },
  { name: 'getAccountInfo', params: [{ name: 'pubkey', type: 'string', description: 'Account public key', required: true }, { name: 'config', type: 'object', description: 'Configuration object', required: false }], description: 'Get account information' },
  { name: 'getBlock', params: [{ name: 'slot', type: 'number', description: 'Slot number', required: true }, { name: 'config', type: 'object', description: 'Configuration object', required: false }], description: 'Get block by slot' },
  { name: 'getTransaction', params: [{ name: 'signature', type: 'string', description: 'Transaction signature', required: true }, { name: 'config', type: 'object', description: 'Configuration object', required: false }], description: 'Get transaction details' },
  { name: 'getSignaturesForAddress', params: [{ name: 'address', type: 'string', description: 'Account address', required: true }, { name: 'config', type: 'object', description: 'Configuration object', required: false }], description: 'Get recent signatures' },
  { name: 'getBlockHeight', params: [], description: 'Get current block height' },
  { name: 'getTokenAccountsByOwner', params: [{ name: 'owner', type: 'string', description: 'Owner public key', required: true }, { name: 'filter', type: 'object', description: 'Token filter', required: true }], description: 'Get token accounts by owner' },
];

const cosmosMethods: MethodDefinition[] = [
  { name: '/cosmos/bank/v1beta1/balances/{address}', params: [{ name: 'address', type: 'string', description: 'Account address', required: true }], description: 'Get all balances' },
  { name: '/cosmos/bank/v1beta1/balances/{address}/by_denom', params: [{ name: 'address', type: 'string', description: 'Account address', required: true }, { name: 'denom', type: 'string', description: 'Token denomination', required: true }], description: 'Get balance by denom' },
  { name: '/cosmos/staking/v1beta1/delegations/{delegatorAddr}', params: [{ name: 'delegatorAddr', type: 'string', description: 'Delegator address', required: true }], description: 'Get delegations' },
  { name: '/cosmos/distribution/v1beta1/delegators/{delegatorAddr}/rewards', params: [{ name: 'delegatorAddr', type: 'string', description: 'Delegator address', required: true }], description: 'Get staking rewards' },
  { name: '/cosmos/staking/v1beta1/validators', params: [], description: 'Get validator list' },
  { name: '/cosmos/staking/v1beta1/validators/{validatorAddr}', params: [{ name: 'validatorAddr', type: 'string', description: 'Validator address', required: true }], description: 'Get validator details' },
  { name: '/cosmos/tx/v1beta1/txs/{hash}', params: [{ name: 'hash', type: 'string', description: 'Transaction hash', required: true }], description: 'Get transaction by hash' },
  { name: '/cosmos/gov/v1beta1/proposals', params: [], description: 'Get governance proposals' },
  { name: '/cosmos/gov/v1beta1/proposals/{proposalId}', params: [{ name: 'proposalId', type: 'string', description: 'Proposal ID', required: true }], description: 'Get specific proposal' },
  { name: '/cosmos/gov/v1beta1/proposals/{proposalId}/votes', params: [{ name: 'proposalId', type: 'string', description: 'Proposal ID', required: true }], description: 'Get proposal votes' },
  { name: '/cosmos/base/tendermint/v1beta1/blocks/latest', params: [], description: 'Get latest block' },
  { name: '/cosmos/base/tendermint/v1beta1/blocks/{height}', params: [{ name: 'height', type: 'string', description: 'Block height', required: true }], description: 'Get block by height' },
];

const suiMethods: MethodDefinition[] = [
  { name: 'suix_getBalance', params: [{ name: 'owner', type: 'string', description: 'Owner address', required: true }, { name: 'coinType', type: 'string', description: 'Coin type', required: false, default: '0x2::sui::SUI' }], description: 'Get balance' },
  { name: 'sui_getObject', params: [{ name: 'objectId', type: 'string', description: 'Object ID', required: true }, { name: 'options', type: 'object', description: 'Display options', required: false }], description: 'Get object by ID' },
  { name: 'suix_getOwnedObjects', params: [{ name: 'owner', type: 'string', description: 'Owner address', required: true }, { name: 'query', type: 'object', description: 'Query filter', required: false }], description: 'Get owned objects' },
  { name: 'sui_getTransactionBlock', params: [{ name: 'digest', type: 'string', description: 'Transaction digest', required: true }, { name: 'options', type: 'object', description: 'Display options', required: false }], description: 'Get transaction by digest' },
  { name: 'suix_getCoins', params: [{ name: 'owner', type: 'string', description: 'Owner address', required: true }, { name: 'coinType', type: 'string', description: 'Coin type', required: false }, { name: 'cursor', type: 'string', description: 'Pagination cursor', required: false }, { name: 'limit', type: 'number', description: 'Max results', required: false }], description: 'Get coins with pagination' },
  { name: 'sui_getLatestCheckpointSequenceNumber', params: [], description: 'Get latest checkpoint' },
];

const nearMethods: MethodDefinition[] = [
  { name: 'query', params: [{ name: 'request_type', type: 'string', description: 'Query type: view_account, call_function, view_access_key_list, view_state, view_code', required: true }, { name: 'finality', type: 'string', description: 'Block finality', required: false, default: 'final' }, { name: 'account_id', type: 'string', description: 'Account ID', required: false }, { name: 'method_name', type: 'string', description: 'Function name (for call_function)', required: false }, { name: 'args_base64', type: 'string', description: 'Base64 encoded args (for call_function)', required: false }, { name: 'prefix_base64', type: 'string', description: 'Key prefix (for view_state)', required: false }], description: 'Query blockchain state' },
  { name: 'block', params: [{ name: 'block_id', type: 'number', description: 'Block height or hash', required: false }, { name: 'finality', type: 'string', description: 'Block finality', required: false, default: 'final' }], description: 'Get block' },
  { name: 'tx', params: [{ name: 'tx_hash', type: 'string', description: 'Transaction hash', required: true }, { name: 'sender_account_id', type: 'string', description: 'Sender account ID', required: true }], description: 'Get transaction status' },
  { name: 'status', params: [], description: 'Get node status' },
];

const radixMethods: MethodDefinition[] = [
  { name: '/status/network-status', params: [], description: 'Get network status (state version, epoch, round, timestamp)' },
  { name: '/status/network-configuration', params: [], description: 'Get network configuration (version info, well-known addresses)' },
  { name: '/lts/state/account-all-fungible-resource-balances', params: [{ name: 'account_address', type: 'string', description: 'Radix account address', required: true }], description: 'Get all fungible token balances for an account' },
  { name: '/lts/transaction/status', params: [{ name: 'intent_hash', type: 'string', description: 'Transaction intent hash', required: true }], description: 'Get transaction status' },
  { name: '/state/consensus-manager', params: [], description: 'Get consensus manager state (validator set, epoch info)' },
];

const tronMethods: MethodDefinition[] = [
  ...evmMethods, // Tron supports EVM methods via compatibility layer
];

/** Protocol registry — maps protocol names to their definitions */
const PROTOCOL_REGISTRY: Record<string, ProtocolDefinition> = {
  evm: {
    rpc_type: 'json-rpc',
    methods: evmMethods,
    address_format: '^0x[a-fA-F0-9]{40}$',
    units: { base: 'wei', display: 'ETH', divisor: BigInt('1000000000000000000') },
  },
  solana: {
    rpc_type: 'json-rpc',
    methods: solanaMethods,
    address_format: '^[1-9A-HJ-NP-Za-km-z]{32,44}$',
    units: { base: 'lamports', display: 'SOL', divisor: BigInt('1000000000') },
  },
  cosmos: {
    rpc_type: 'rest',
    methods: cosmosMethods,
    address_format: '^[a-z]+1[a-z0-9]{38,58}$',
  },
  sui: {
    rpc_type: 'json-rpc',
    methods: suiMethods,
    units: { base: 'MIST', display: 'SUI', divisor: BigInt('1000000000') },
  },
  near: {
    rpc_type: 'json-rpc',
    methods: nearMethods,
    address_format: '^([a-z0-9._-]+\\.near|[a-f0-9]{64})$',
    units: { base: 'yoctoNEAR', display: 'NEAR', divisor: BigInt('1000000000000000000000000') },
  },
  radix: {
    rpc_type: 'post-rest',
    methods: radixMethods,
    address_format: '^(account_|resource_|component_|package_|pool_|validator_)[a-z0-9_]+$',
    units: { base: 'atto', display: 'XRD', divisor: BigInt('1000000000000000000') },
  },
  tron: {
    rpc_type: 'json-rpc',
    methods: tronMethods,
    address_format: '^T[a-zA-Z0-9]{33}$',
    units: { base: 'SUN', display: 'TRX', divisor: BigInt('1000000') },
  },
};

/** Get the protocol definition for a given protocol name */
export function getProtocolDefinition(protocol: string): ProtocolDefinition {
  const def = PROTOCOL_REGISTRY[protocol];
  if (!def) {
    throw new Error(`Unknown protocol: ${protocol}`);
  }
  return def;
}

/** Check if a chain is EVM-compatible (native EVM or evm_compatible flag) */
export function isEvmCompatible(chain: { protocol: string; evm_compatible?: boolean }): boolean {
  return chain.protocol === 'evm' || chain.evm_compatible === true;
}

/** Get all registered protocol names */
export function getRegisteredProtocols(): string[] {
  return Object.keys(PROTOCOL_REGISTRY);
}

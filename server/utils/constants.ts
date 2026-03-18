/**
 * BlockchainQuery MCP — Protocol Constants
 */

// === ERC-20 Function Selectors ===
export const ERC20_SELECTORS = {
  balanceOf: '0x70a08231',
  decimals: '0x313ce567',
  symbol: '0x95d89b41',
  name: '0x06fdde03',
  totalSupply: '0x18160ddd',
} as const;

// === Program IDs ===
export const SOLANA_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

// === Default Coin Types ===
export const SUI_DEFAULT_COIN_TYPE = '0x2::sui::SUI';

// === Domain Resolution Contracts ===
export const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
export const ENS_RESOLVER = '0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63';
export const UD_PROXY_READER = '0xA3f32c8cd786dc089Bd1fC175F2707223aeE5d00';

// === Address Regex Patterns ===
export const ADDRESS_PATTERNS = {
  evm: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  cosmos: /^[a-z]+1[a-z0-9]{38,58}$/,
  near_named: /^[a-z0-9._-]+\.near$/,
  near_implicit: /^[a-f0-9]{64}$/,
  tron: /^T[a-zA-Z0-9]{33}$/,
} as const;

// === Unit Systems ===
export const UNIT_SYSTEMS: Record<string, { base: string; display: string; divisor: bigint }> = {
  evm: { base: 'wei', display: 'ETH', divisor: BigInt('1000000000000000000') },    // 1e18
  solana: { base: 'lamports', display: 'SOL', divisor: BigInt('1000000000') },       // 1e9
  sui: { base: 'MIST', display: 'SUI', divisor: BigInt('1000000000') },              // 1e9
  near: { base: 'yoctoNEAR', display: 'NEAR', divisor: BigInt('1000000000000000000000000') }, // 1e24
  tron: { base: 'SUN', display: 'TRX', divisor: BigInt('1000000') },                 // 1e6
  cosmos_pokt: { base: 'upokt', display: 'POKT', divisor: BigInt('1000000') },       // 1e6
} as const;

// === Safety Limits ===
export const MAX_BLOCK_RANGE = 10;
export const MAX_COMPARE_CHAINS = 5;
export const MAX_RESPONSE_SIZE = 50 * 1024; // 50KB
export const MAX_NEAR_ARGS_SIZE = 10 * 1024; // 10KB
export const RPC_TIMEOUT_MS = 30_000;

// === Dangerous Methods Blocklist ===
export const DANGEROUS_METHODS = [
  'debug_traceTransaction',
  'debug_traceCall',
  'debug_storageRangeAt',
  'trace_block',
] as const;

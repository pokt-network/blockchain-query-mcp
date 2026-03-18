/**
 * BlockchainQuery MCP — EVM Service
 *
 * High-level helpers for EVM-compatible chains (Ethereum, Polygon, BNB, etc.)
 * and Tron (EVM-compatible via evm_compatible flag).
 */

import { registry } from './chain-registry.js';
import { dispatch } from './rpc-dispatcher.js';
import { isEvmCompatible } from '../protocols/method-registry.js';
import { ERC20_SELECTORS, UNIT_SYSTEMS } from '../utils/constants.js';
import type { ChainInfo, RpcResponse } from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve and validate a chain slug as EVM-compatible.
 * Throws a descriptive error if the chain is unknown or not EVM.
 */
function resolveEvmChain(slug: string): ChainInfo {
  const chain = registry.getChain(slug);
  if (!chain) {
    throw new Error(`Unknown chain: '${slug}'. Check the supported-chains registry.`);
  }
  if (!isEvmCompatible(chain)) {
    throw new Error(
      `Chain '${slug}' uses protocol '${chain.protocol}' and is not EVM-compatible.`,
    );
  }
  return chain;
}

/**
 * Convert a hex balance string to a human-readable amount using the chain's
 * unit system.  Falls back to the 'evm' unit system if the protocol is not
 * found in UNIT_SYSTEMS.
 */
function formatBalance(
  hexValue: string,
  protocol: string,
): { raw: string; formatted: string; unit: string } {
  const units =
    UNIT_SYSTEMS[protocol] ??
    UNIT_SYSTEMS['tron'] ??   // tron is a known variant
    UNIT_SYSTEMS['evm']!;

  const raw = BigInt(hexValue);
  const divisor = units.divisor;

  // Integer division + remainder for decimal formatting
  const whole = raw / divisor;
  const remainder = raw % divisor;

  // Build a decimal string with up to 6 significant fractional digits
  const decimals = divisor.toString().length - 1; // e.g. 18 for evm
  const displayDecimals = Math.min(6, decimals);
  const scale = BigInt(10 ** (decimals - displayDecimals));
  const fracPart = (remainder / scale).toString().padStart(displayDecimals, '0');

  const formatted = `${whole.toString()}.${fracPart} ${units.display}`;

  return { raw: raw.toString(), formatted, unit: units.display };
}

/**
 * Decode an ABI-encoded `string` return value.
 * Layout: [0..31] offset pointer | [32..63] string length | [64..] UTF-8 bytes.
 */
function decodeString(hex: string): string {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Each ABI slot is 32 bytes = 64 hex chars
  const lengthHex = clean.slice(64, 128);
  const byteLength = parseInt(lengthHex, 16);

  if (!byteLength || Number.isNaN(byteLength)) return '';

  const dataHex = clean.slice(128, 128 + byteLength * 2);
  const bytes = new Uint8Array(dataHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(dataHex.slice(i * 2, i * 2 + 2), 16);
  }

  return new TextDecoder().decode(bytes);
}

/**
 * Decode an ABI-encoded `uint256` return value (right-padded 32-byte slot).
 */
function decodeUint256(hex: string): bigint {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + (clean || '0'));
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/** Get the native coin balance for `address` on the given EVM chain. */
async function getBalance(slug: string, address: string): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);

  try {
    const raw = await dispatch(chain, 'eth_getBalance', [address, 'latest']);
    if (!raw.success || typeof raw.data !== 'string') return raw;

    const formatted = formatBalance(raw.data, chain.protocol);
    return { ...raw, data: { hex: raw.data, ...formatted } };
  } catch (err) {
    return { success: false, error: String(err), chain: slug, method: 'eth_getBalance' };
  }
}

/** Get a block by number or hash.  fullTx is always false for safety. */
async function getBlock(slug: string, blockId: string): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);

  // Heuristic: block hashes are 66-char hex strings starting with 0x
  const isHash = blockId.startsWith('0x') && blockId.length === 66;
  const method = isHash ? 'eth_getBlockByHash' : 'eth_getBlockByNumber';

  return dispatch(chain, method, [blockId, false]);
}

/** Get a transaction by hash. */
async function getTransaction(slug: string, txHash: string): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, 'eth_getTransactionByHash', [txHash]);
}

/** Get a transaction receipt by hash. */
async function getReceipt(slug: string, txHash: string): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, 'eth_getTransactionReceipt', [txHash]);
}

/** Get event logs matching `filter`.  Safety is pre-checked by the handler. */
async function getLogs(slug: string, filter: object): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, 'eth_getLogs', [filter]);
}

/** Estimate gas for a transaction object. */
async function estimateGas(slug: string, txObject: object): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, 'eth_estimateGas', [txObject]);
}

/**
 * Fetch ERC-20 token metadata (and optional wallet balance).
 * Makes parallel eth_call requests for: decimals, symbol, name, totalSupply.
 * If `walletAddress` is provided, also fetches balanceOf.
 */
async function getTokenInfo(
  slug: string,
  tokenAddress: string,
  walletAddress?: string,
): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);

  // Build eth_call params for a given 4-byte selector (no additional args)
  const callParams = (selector: string) => [{ to: tokenAddress, data: selector }, 'latest'];

  // balanceOf(address) = selector + address padded to 32 bytes (64 hex chars)
  const balanceOfData = walletAddress
    ? ERC20_SELECTORS.balanceOf +
      (walletAddress.startsWith('0x') ? walletAddress.slice(2) : walletAddress).padStart(64, '0')
    : null;

  // Fire all calls in parallel
  const calls: Promise<RpcResponse>[] = [
    dispatch(chain, 'eth_call', callParams(ERC20_SELECTORS.decimals)),
    dispatch(chain, 'eth_call', callParams(ERC20_SELECTORS.symbol)),
    dispatch(chain, 'eth_call', callParams(ERC20_SELECTORS.name)),
    dispatch(chain, 'eth_call', callParams(ERC20_SELECTORS.totalSupply)),
  ];

  if (balanceOfData) {
    calls.push(dispatch(chain, 'eth_call', [{ to: tokenAddress, data: balanceOfData }, 'latest']));
  }

  try {
    const [decimalsRes, symbolRes, nameRes, supplyRes, balanceRes] = await Promise.all(calls);

    const decimals =
      decimalsRes.success && typeof decimalsRes.data === 'string'
        ? Number(decodeUint256(decimalsRes.data))
        : null;

    const symbol =
      symbolRes.success && typeof symbolRes.data === 'string'
        ? decodeString(symbolRes.data)
        : null;

    const name =
      nameRes.success && typeof nameRes.data === 'string' ? decodeString(nameRes.data) : null;

    const totalSupply =
      supplyRes.success && typeof supplyRes.data === 'string'
        ? decodeUint256(supplyRes.data).toString()
        : null;

    const walletBalance =
      balanceRes?.success && typeof balanceRes.data === 'string'
        ? decodeUint256(balanceRes.data).toString()
        : undefined;

    const result: Record<string, unknown> = {
      address: tokenAddress,
      name,
      symbol,
      decimals,
      totalSupply,
    };
    if (walletAddress !== undefined) {
      result['walletBalance'] = walletBalance ?? null;
      result['wallet'] = walletAddress;
    }

    return { success: true, data: result, chain: slug, method: 'getTokenInfo' };
  } catch (err) {
    return { success: false, error: String(err), chain: slug, method: 'getTokenInfo' };
  }
}

/** Execute a read-only contract call with arbitrary calldata. */
async function callContract(slug: string, to: string, data: string): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, 'eth_call', [{ to, data }, 'latest']);
}

/** Dispatch any arbitrary EVM method + params directly. */
async function genericCall(
  slug: string,
  method: string,
  params: unknown[],
): Promise<RpcResponse> {
  const chain = resolveEvmChain(slug);
  return dispatch(chain, method, params);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const evmService = {
  getBalance,
  getBlock,
  getTransaction,
  getReceipt,
  getLogs,
  estimateGas,
  getTokenInfo,
  callContract,
  genericCall,
};

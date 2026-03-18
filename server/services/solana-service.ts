/**
 * BlockchainQuery MCP — Solana Service
 *
 * High-level helpers for the Solana blockchain.
 */

import { registry } from './chain-registry.js';
import { dispatch } from './rpc-dispatcher.js';
import { SOLANA_TOKEN_PROGRAM_ID } from '../utils/constants.js';
import type { RpcResponse } from '../types/index.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve the canonical 'solana' mainnet chain from the registry. */
function resolveSolanaChain() {
  const chain = registry.getChain('solana');
  if (!chain) {
    throw new Error(`Chain 'solana' is not present in the registry.`);
  }
  return chain;
}

// Lamports per SOL
const LAMPORTS_PER_SOL = BigInt('1000000000');

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Get the SOL balance for `address`.
 * If `mintAddress` is provided, instead return the SPL token account(s)
 * owned by `address` for that mint.
 */
async function getBalance(address: string, mintAddress?: string): Promise<RpcResponse> {
  const chain = resolveSolanaChain();

  if (!mintAddress) {
    // Native SOL balance — result is lamports as a plain number
    const raw = await dispatch(chain, 'getBalance', [address]);
    if (!raw.success) return raw;

    const lamports = typeof raw.data === 'number' ? BigInt(raw.data) : null;
    const sol =
      lamports !== null
        ? (Number(lamports) / Number(LAMPORTS_PER_SOL)).toFixed(9) + ' SOL'
        : null;

    return {
      ...raw,
      data: {
        address,
        lamports: lamports !== null ? lamports.toString() : raw.data,
        sol,
      },
    };
  }

  // SPL token balance via getTokenAccountsByOwner
  return dispatch(chain, 'getTokenAccountsByOwner', [
    address,
    { mint: mintAddress },
    { encoding: 'jsonParsed' },
  ]);
}

/** Get detailed account info for `address` using jsonParsed encoding. */
async function getAccount(address: string): Promise<RpcResponse> {
  const chain = resolveSolanaChain();
  return dispatch(chain, 'getAccountInfo', [address, { encoding: 'jsonParsed' }]);
}

/**
 * Get a block by slot number.
 * Uses signature-only transaction details to keep the response size manageable.
 */
async function getBlock(slot: number): Promise<RpcResponse> {
  const chain = resolveSolanaChain();
  return dispatch(chain, 'getBlock', [
    slot,
    {
      encoding: 'json',
      transactionDetails: 'signatures',
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

/** Get full transaction details for a given signature. */
async function getTransaction(signature: string): Promise<RpcResponse> {
  const chain = resolveSolanaChain();
  return dispatch(chain, 'getTransaction', [
    signature,
    {
      encoding: 'jsonParsed',
      maxSupportedTransactionVersion: 0,
    },
  ]);
}

/**
 * Get recent confirmed signatures for an address.
 * Defaults to the last 10 signatures when no limit is provided.
 */
async function getSignatures(address: string, limit?: number): Promise<RpcResponse> {
  const chain = resolveSolanaChain();
  return dispatch(chain, 'getSignaturesForAddress', [address, { limit: limit ?? 10 }]);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// Re-export the token program ID for convenience
export { SOLANA_TOKEN_PROGRAM_ID };

export const solanaService = {
  getBalance,
  getAccount,
  getBlock,
  getTransaction,
  getSignatures,
};

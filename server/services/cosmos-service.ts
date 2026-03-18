/**
 * BlockchainQuery MCP — Cosmos Service
 *
 * Provides typed helpers for Cosmos SDK REST endpoints.
 * Uses the chain registry to resolve slugs and the RPC dispatcher
 * to make outbound REST calls.
 */

import type { ChainInfo, RpcResponse } from '../types/index.js';
import { registry } from './chain-registry.js';
import { dispatch } from './rpc-dispatcher.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a chain slug to a ChainInfo, asserting it is a Cosmos chain.
 * Returns an error-shaped RpcResponse via thrown object so callers can
 * do: `const chain = resolveCosmosChain(slug) ?? return earlyError`
 *
 * We use a sentinel throw pattern so service methods can stay concise.
 */
function resolveCosmosChain(slug: string): ChainInfo {
  const chain = registry.getChain(slug);
  if (!chain) {
    throw new Error(`Chain '${slug}' not found in registry.`);
  }
  if (chain.protocol !== 'cosmos') {
    throw new Error(`Chain '${slug}' uses protocol '${chain.protocol}', expected 'cosmos'.`);
  }
  return chain;
}

/** Wrap a thrown error from resolveCosmosChain into an RpcResponse. */
function chainError(slug: string, method: string, err: unknown): RpcResponse {
  const error = err instanceof Error ? err.message : String(err);
  return { success: false, error, chain: slug, method };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Get token balances for an address.
 * If `denom` is supplied, returns the balance for that specific denomination.
 */
async function getBalance(slug: string, address: string, denom?: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getBalance', err);
  }

  if (denom) {
    const method = `/cosmos/bank/v1beta1/balances/{address}/by_denom?denom=${encodeURIComponent(denom)}`;
    return dispatch(chain, method, { address });
  }

  return dispatch(chain, `/cosmos/bank/v1beta1/balances/{address}`, { address });
}

/**
 * Get staking delegations and rewards for a delegator address.
 * Makes two parallel REST calls and combines the results.
 */
async function getStaking(slug: string, delegatorAddr: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getStaking', err);
  }

  const [delegationsResult, rewardsResult] = await Promise.all([
    dispatch(chain, `/cosmos/staking/v1beta1/delegations/{delegatorAddr}`, { delegatorAddr }),
    dispatch(chain, `/cosmos/distribution/v1beta1/delegators/{delegatorAddr}/rewards`, { delegatorAddr }),
  ]);

  if (!delegationsResult.success) {
    return delegationsResult;
  }
  if (!rewardsResult.success) {
    return rewardsResult;
  }

  return {
    success: true,
    data: {
      delegations: delegationsResult.data,
      rewards: rewardsResult.data,
    },
    chain: chain.slug,
    method: 'getStaking',
  };
}

/**
 * Get validator information.
 * If `validatorAddr` is supplied, returns a single validator; otherwise returns the full list.
 */
async function getValidators(slug: string, validatorAddr?: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getValidators', err);
  }

  if (validatorAddr) {
    return dispatch(chain, `/cosmos/staking/v1beta1/validators/{validatorAddr}`, { validatorAddr });
  }

  return dispatch(chain, `/cosmos/staking/v1beta1/validators`, {});
}

/**
 * Get a transaction by its hash.
 */
async function getTransaction(slug: string, txHash: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getTransaction', err);
  }

  return dispatch(chain, `/cosmos/tx/v1beta1/txs/{hash}`, { hash: txHash });
}

/**
 * Get governance proposals.
 * If `proposalId` is supplied, returns a single proposal; otherwise returns all proposals.
 */
async function getGovernance(slug: string, proposalId?: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getGovernance', err);
  }

  if (proposalId) {
    return dispatch(chain, `/cosmos/gov/v1beta1/proposals/{proposalId}`, { proposalId });
  }

  return dispatch(chain, `/cosmos/gov/v1beta1/proposals`, {});
}

/**
 * Get a block by height, or the latest block if no height is provided.
 */
async function getBlock(slug: string, height?: string): Promise<RpcResponse> {
  let chain: ChainInfo;
  try {
    chain = resolveCosmosChain(slug);
  } catch (err) {
    return chainError(slug, 'getBlock', err);
  }

  if (height) {
    return dispatch(chain, `/cosmos/base/tendermint/v1beta1/blocks/{height}`, { height });
  }

  return dispatch(chain, `/cosmos/base/tendermint/v1beta1/blocks/latest`, {});
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const cosmosService = {
  getBalance,
  getStaking,
  getValidators,
  getTransaction,
  getGovernance,
  getBlock,
};

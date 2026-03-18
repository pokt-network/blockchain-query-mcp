/**
 * BlockchainQuery MCP — Safety Checks
 *
 * Pre-dispatch validation and post-dispatch response size guardrails.
 */

import type { SafetyCheckResult } from '../types/index.js';
import {
  DANGEROUS_METHODS,
  MAX_BLOCK_RANGE,
  MAX_COMPARE_CHAINS,
  MAX_RESPONSE_SIZE,
  MAX_NEAR_ARGS_SIZE,
} from './constants.js';

// ---------------------------------------------------------------------------
// Pre-dispatch validation
// ---------------------------------------------------------------------------

/**
 * Validate an RPC method + params before dispatching.
 * Returns `{allowed: false, reason}` when the call should be rejected.
 */
export function preCheck(method: string, params: unknown): SafetyCheckResult {
  // --- Blocklist ---
  if ((DANGEROUS_METHODS as readonly string[]).includes(method)) {
    return { allowed: false, reason: `Method '${method}' is blocked for safety reasons.` };
  }

  // --- Full-transaction blocks are too large ---
  if (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') {
    const p = Array.isArray(params) ? params : [];
    if (p[1] === true) {
      return {
        allowed: false,
        reason: `Full transaction objects in block responses are not permitted (fullTx must be false).`,
      };
    }
  }

  // --- eth_getLogs block-range limit ---
  if (method === 'eth_getLogs') {
    const p = Array.isArray(params) ? params : [];
    const filter = p[0];

    if (filter == null || typeof filter !== 'object') {
      return { allowed: false, reason: 'eth_getLogs requires a filter object as the first parameter.' };
    }

    const f = filter as Record<string, unknown>;

    // Must have at least address or topics to avoid unbounded queries
    if (f['address'] == null && f['topics'] == null) {
      return {
        allowed: false,
        reason: 'eth_getLogs filter must specify at least one of: address, topics.',
      };
    }

    const fromRaw = f['fromBlock'];
    const toRaw = f['toBlock'];

    // Only validate range when both ends are explicit hex block numbers
    if (
      typeof fromRaw === 'string' &&
      fromRaw.startsWith('0x') &&
      typeof toRaw === 'string' &&
      toRaw.startsWith('0x') &&
      toRaw !== 'latest'
    ) {
      const from = parseInt(fromRaw, 16);
      const to = parseInt(toRaw, 16);

      if (!Number.isNaN(from) && !Number.isNaN(to)) {
        const range = to - from;
        if (range > MAX_BLOCK_RANGE) {
          return {
            allowed: false,
            reason: `eth_getLogs block range ${range} exceeds the maximum of ${MAX_BLOCK_RANGE}.`,
          };
        }
      }
    }
  }

  // --- compare_balances chain count limit ---
  if (method === 'compare_balances') {
    const p = Array.isArray(params) ? params : [];
    const chains = p[0];
    if (Array.isArray(chains) && chains.length > MAX_COMPARE_CHAINS) {
      return {
        allowed: false,
        reason: `compare_balances accepts at most ${MAX_COMPARE_CHAINS} chains; ${chains.length} provided.`,
      };
    }
  }

  // --- Near call_function: args payload size ---
  if (method === 'query') {
    const p = Array.isArray(params) ? params : [];
    const queryObj = p[0];

    if (queryObj != null && typeof queryObj === 'object') {
      const q = queryObj as Record<string, unknown>;

      // call_function args_base64 size guard
      if (q['request_type'] === 'call_function') {
        const argsB64 = q['args_base64'];
        if (typeof argsB64 === 'string') {
          let decodedLength: number;
          try {
            // In Node ≥ 16 we can use Buffer; in browser-like environments, atob
            if (typeof Buffer !== 'undefined') {
              decodedLength = Buffer.from(argsB64, 'base64').length;
            } else {
              decodedLength = atob(argsB64).length;
            }
          } catch {
            return { allowed: false, reason: 'Near call_function: args_base64 is not valid base64.' };
          }

          if (decodedLength > MAX_NEAR_ARGS_SIZE) {
            return {
              allowed: false,
              reason: `Near call_function args_base64 decoded size ${decodedLength} bytes exceeds the maximum of ${MAX_NEAR_ARGS_SIZE} bytes.`,
            };
          }
        }
      }

      // view_state: prefix_base64 must be present
      if (q['request_type'] === 'view_state') {
        const prefix = q['prefix_base64'];
        if (prefix == null || prefix === '') {
          return {
            allowed: false,
            reason: 'Near view_state requires a non-empty prefix_base64 to prevent unbounded state reads.',
          };
        }
      }
    }
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Post-dispatch response size check
// ---------------------------------------------------------------------------

const TRUNCATE_AT = Math.floor(MAX_RESPONSE_SIZE * 0.8); // 40 KB

/**
 * Inspect a raw RPC response and truncate it when it exceeds MAX_RESPONSE_SIZE.
 */
export function postCheck(response: unknown): { data: unknown; truncated: boolean } {
  const serialised = JSON.stringify(response);

  if (serialised.length <= MAX_RESPONSE_SIZE) {
    return { data: response, truncated: false };
  }

  return {
    data: {
      warning: `Response truncated: original size ${serialised.length} bytes exceeded the ${MAX_RESPONSE_SIZE}-byte limit.`,
      partial: serialised.slice(0, TRUNCATE_AT),
    },
    truncated: true,
  };
}

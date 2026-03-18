/**
 * BlockchainQuery MCP — RPC Dispatcher
 *
 * Routes outbound calls to either a JSON-RPC endpoint or a REST endpoint
 * based on the protocol definition, with retry logic for rate-limiting and
 * service-unavailability responses.
 */

import type { ChainInfo, RpcResponse } from '../types/index.js';
import { getProtocolDefinition } from '../protocols/method-registry.js';
import { RPC_TIMEOUT_MS } from '../utils/constants.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Pause for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform a fetch with an AbortController timeout.
 * Throws on network error, abort, or if `signal` fires first.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller already provided a signal, combine them.
  const signal = init.signal
    ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([
        controller.signal,
        init.signal as AbortSignal,
      ])
    : controller.signal;

  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC dispatcher
// ---------------------------------------------------------------------------

export async function dispatchJsonRpc(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  let response = await fetchWithTimeout(url, init, timeoutMs);

  // Retry once on 429 or 503
  if (response.status === 429 || response.status === 503) {
    await sleep(1_000);
    response = await fetchWithTimeout(url, init, timeoutMs);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new Error(`Failed to parse JSON response from ${url}`);
  }

  // Standard JSON-RPC error object
  const rpcResponse = parsed as { result?: unknown; error?: { message?: string; code?: number } };
  if (rpcResponse.error) {
    const msg = rpcResponse.error.message ?? 'Unknown JSON-RPC error';
    const code = rpcResponse.error.code != null ? ` (code ${rpcResponse.error.code})` : '';
    throw new Error(`JSON-RPC error: ${msg}${code}`);
  }

  return rpcResponse.result;
}

// ---------------------------------------------------------------------------
// REST dispatcher
// ---------------------------------------------------------------------------

export async function dispatchRest(
  url: string,
  path: string,
  params: Record<string, string>,
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<unknown> {
  // Interpolate {placeholder} tokens in the path
  const interpolated = path.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(value);
  });

  const fullUrl = `${url}${interpolated}`;
  const init: RequestInit = { method: 'GET' };

  let response = await fetchWithTimeout(fullUrl, init, timeoutMs);

  // Retry once on 429 or 503
  if (response.status === 429 || response.status === 503) {
    await sleep(1_000);
    response = await fetchWithTimeout(fullUrl, init, timeoutMs);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${fullUrl}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`Failed to parse JSON response from ${fullUrl}`);
  }
}

// ---------------------------------------------------------------------------
// POST-REST dispatcher (e.g. Radix Gateway API)
// ---------------------------------------------------------------------------

export async function dispatchPostRest(
  url: string,
  path: string,
  body: unknown,
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<unknown> {
  const fullUrl = `${url}${path}`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  };

  let response = await fetchWithTimeout(fullUrl, init, timeoutMs);

  // Retry once on 429 or 503
  if (response.status === 429 || response.status === 503) {
    await sleep(1_000);
    response = await fetchWithTimeout(fullUrl, init, timeoutMs);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${fullUrl}`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error(`Failed to parse JSON response from ${fullUrl}`);
  }
}

// ---------------------------------------------------------------------------
// Main dispatch entry point
// ---------------------------------------------------------------------------

/**
 * Dispatch a blockchain RPC call for the given chain, returning a normalised
 * `RpcResponse` wrapper regardless of success or failure.
 *
 * @param chain  - Chain descriptor from the registry
 * @param method - Method name (JSON-RPC method string or REST path template)
 * @param params - Parameters — array for JSON-RPC, object for REST
 */
export async function dispatch(
  chain: ChainInfo,
  method: string,
  params: unknown,
): Promise<RpcResponse> {
  // Chains explicitly marked inactive should never be dispatched
  const status = chain.status ?? 'active';
  if (status === 'inactive') {
    return {
      success: false,
      error: `Chain '${chain.slug}' is inactive and not available for querying.`,
      chain: chain.slug,
      method,
    };
  }

  let rpcType: 'json-rpc' | 'rest' | 'post-rest';
  try {
    const def = getProtocolDefinition(chain.protocol);
    rpcType = def.rpc_type;
  } catch {
    // Unknown protocol — not supported
    return {
      success: false,
      error: `Protocol '${chain.protocol}' is not supported.`,
      chain: chain.slug,
      method,
    };
  }

  try {
    let data: unknown;

    if (rpcType === 'json-rpc') {
      const paramsArray = Array.isArray(params) ? params : params != null ? [params] : [];
      data = await dispatchJsonRpc(chain.url, method, paramsArray, RPC_TIMEOUT_MS);
    } else if (rpcType === 'post-rest') {
      data = await dispatchPostRest(chain.url, method, params, RPC_TIMEOUT_MS);
    } else {
      const paramsObj =
        params !== null && typeof params === 'object' && !Array.isArray(params)
          ? (params as Record<string, string>)
          : {};
      data = await dispatchRest(chain.url, method, paramsObj, RPC_TIMEOUT_MS);
    }

    return { success: true, data, chain: chain.slug, method };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error, chain: chain.slug, method };
  }
}

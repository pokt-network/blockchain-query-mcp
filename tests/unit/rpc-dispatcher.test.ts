import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatch, dispatchJsonRpc, dispatchRest } from '../../server/services/rpc-dispatcher.js';
import type { ChainInfo } from '../../server/types/index.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const ETH_CHAIN: ChainInfo = {
  name: 'Ethereum',
  slug: 'eth',
  protocol: 'evm',
  url: 'https://eth.api.pocket.network',
  network: 'mainnet',
};

const COSMOS_CHAIN: ChainInfo = {
  name: 'Osmosis',
  slug: 'osmosis',
  protocol: 'cosmos',
  url: 'https://osmosis.api.pocket.network',
  network: 'mainnet',
};

const INACTIVE_CHAIN: ChainInfo = {
  name: 'Radix',
  slug: 'radix',
  protocol: 'radix',
  url: 'https://radix.api.pocket.network',
  network: 'mainnet',
  status: 'inactive',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('RpcDispatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // JSON-RPC mode
  // -----------------------------------------------------------------------

  test('JSON-RPC mode constructs correct envelope', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await dispatchJsonRpc(ETH_CHAIN.url, 'eth_chainId', [], 5_000);

    expect(result).toBe('0x1');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(ETH_CHAIN.url);
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    });
  });

  test('JSON-RPC error in response is propagated', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      dispatchJsonRpc(ETH_CHAIN.url, 'eth_unknown', [], 5_000),
    ).rejects.toThrow('Method not found');
  });

  // -----------------------------------------------------------------------
  // REST mode
  // -----------------------------------------------------------------------

  test('REST mode interpolates path params correctly', async () => {
    const balanceData = { balances: [{ denom: 'uosmo', amount: '1000000' }] };
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse(balanceData));
    vi.stubGlobal('fetch', mockFetch);

    const result = await dispatchRest(
      COSMOS_CHAIN.url,
      '/cosmos/bank/v1beta1/balances/{address}',
      { address: 'osmo1abc123' },
      5_000,
    );

    expect(result).toEqual(balanceData);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe(
      `${COSMOS_CHAIN.url}/cosmos/bank/v1beta1/balances/osmo1abc123`,
    );
  });

  test('REST mode with multiple path params', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ proposal: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await dispatchRest(
      COSMOS_CHAIN.url,
      '/cosmos/gov/v1beta1/proposals/{proposalId}/votes',
      { proposalId: '42' },
      5_000,
    );

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/proposals/42/votes');
  });

  // -----------------------------------------------------------------------
  // Retry logic
  // -----------------------------------------------------------------------

  test('429 errors trigger a retry (fetch called twice)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse(null, 429))
      .mockResolvedValueOnce(makeJsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }));
    vi.stubGlobal('fetch', mockFetch);

    // Advance fake timers so the 1s sleep resolves
    const promise = dispatchJsonRpc(ETH_CHAIN.url, 'eth_chainId', [], 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('0x1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('503 errors trigger a retry (fetch called twice)', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse(null, 503))
      .mockResolvedValueOnce(makeJsonResponse({ jsonrpc: '2.0', id: 1, result: '0xdead' }));
    vi.stubGlobal('fetch', mockFetch);

    const promise = dispatchJsonRpc(ETH_CHAIN.url, 'eth_chainId', [], 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('0xdead');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('non-retryable 4xx errors are NOT retried', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse(null, 400));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      dispatchJsonRpc(ETH_CHAIN.url, 'eth_chainId', [], 5_000),
    ).rejects.toThrow('HTTP 400');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Timeout
  // -----------------------------------------------------------------------

  test('timeout produces a meaningful error message', async () => {
    const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted', 'AbortError')),
          );
        }
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    // Attach the rejection handler BEFORE advancing timers to prevent unhandled-rejection warnings.
    const promise = dispatchJsonRpc(ETH_CHAIN.url, 'eth_blockNumber', [], 100);
    const resultPromise = promise.catch((err: Error) => err);

    // Advance fake timers so the 100ms AbortController timeout fires
    await vi.runAllTimersAsync();

    const err = await resultPromise;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/timed out/i);
  });

  // -----------------------------------------------------------------------
  // dispatch() wrapper
  // -----------------------------------------------------------------------

  test('dispatch() returns success RpcResponse for JSON-RPC', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await dispatch(ETH_CHAIN, 'eth_chainId', []);
    expect(response.success).toBe(true);
    expect(response.data).toBe('0x1');
    expect(response.chain).toBe('eth');
    expect(response.method).toBe('eth_chainId');
  });

  test('dispatch() returns success RpcResponse for REST', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ block: { header: { height: '1000' } } }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await dispatch(
      COSMOS_CHAIN,
      '/cosmos/base/tendermint/v1beta1/blocks/latest',
      {},
    );
    expect(response.success).toBe(true);
    expect(response.chain).toBe('osmosis');
  });

  test('dispatch() returns error RpcResponse for inactive chains', async () => {
    const response = await dispatch(INACTIVE_CHAIN, 'some_method', []);
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/inactive/i);
    expect(response.chain).toBe('radix');
  });

  test('dispatch() returns error RpcResponse for unknown protocol', async () => {
    const unknownChain: ChainInfo = {
      name: 'Unknown',
      slug: 'unknown',
      protocol: 'unknown-protocol',
      url: 'https://unknown.example.com',
      network: 'mainnet',
    };
    const response = await dispatch(unknownChain, 'some_method', []);
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/not supported/i);
  });

  test('dispatch() wraps fetch errors in RpcResponse', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    const response = await dispatch(ETH_CHAIN, 'eth_blockNumber', []);
    expect(response.success).toBe(false);
    expect(response.error).toMatch(/connection refused/i);
  });

  test('response includes parsed JSON data', async () => {
    const data = { number: '0x10d4f', transactions: [] };
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ jsonrpc: '2.0', id: 1, result: data }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const response = await dispatch(ETH_CHAIN, 'eth_getBlockByNumber', ['latest', false]);
    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });
});

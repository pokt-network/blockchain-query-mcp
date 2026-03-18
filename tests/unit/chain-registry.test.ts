import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChainRegistryService } from '../../server/services/chain-registry.js';

// ---------------------------------------------------------------------------
// Fixture: minimal chain registry that mirrors the real shape
// ---------------------------------------------------------------------------

const FIXTURE_CHAINS = [
  { name: 'Ethereum', slug: 'eth', protocol: 'evm', url: 'https://eth.api.pocket.network', network: 'mainnet' },
  { name: 'Polygon', slug: 'poly', protocol: 'evm', url: 'https://poly.api.pocket.network', network: 'mainnet' },
  { name: 'Solana', slug: 'solana', protocol: 'solana', url: 'https://solana.api.pocket.network', network: 'mainnet' },
  { name: 'Sui', slug: 'sui', protocol: 'sui', url: 'https://sui.api.pocket.network', network: 'mainnet' },
  { name: 'Near', slug: 'near', protocol: 'near', url: 'https://near.api.pocket.network', network: 'mainnet' },
  { name: 'Osmosis', slug: 'osmosis', protocol: 'cosmos', url: 'https://osmosis.api.pocket.network', network: 'mainnet' },
  { name: 'Radix', slug: 'radix', protocol: 'evm', url: 'https://radix.api.pocket.network', network: 'mainnet', status: 'inactive' },
  { name: 'Goerli', slug: 'goerli', protocol: 'evm', url: 'https://goerli.api.pocket.network', network: 'testnet' },
];

const FIXTURE_REGISTRY = {
  version: '2.0.0',
  updated_at: '2026-01-01',
  gateway_base_url: 'https://api.pocket.network',
  chains: FIXTURE_CHAINS,
};

/** Stub fetch to return the fixture registry. */
function stubFetchWithFixture() {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(FIXTURE_REGISTRY),
  });
  vi.stubGlobal('fetch', mockFetch);
  return mockFetch;
}

/** Create a fresh, uninitialised registry for each test. */
function makeRegistry(): ChainRegistryService {
  return new ChainRegistryService();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ChainRegistry', () => {
  let svc: ChainRegistryService;

  beforeEach(async () => {
    vi.stubEnv('ENABLE_LIVENESS_PROBES', 'false');
    stubFetchWithFixture();
    svc = makeRegistry();
    await svc.init();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------

  test('loads chains from remote fetch', () => {
    expect(svc.listChains()).toHaveLength(FIXTURE_CHAINS.length);
  });

  test('getChain("eth") returns Ethereum mainnet with correct url', () => {
    const chain = svc.getChain('eth');
    expect(chain).not.toBeNull();
    expect(chain!.name).toBe('Ethereum');
    expect(chain!.network).toBe('mainnet');
    expect(chain!.url).toBe('https://eth.api.pocket.network');
  });

  test('getChainsByProtocol("evm") returns all EVM chains', () => {
    const evmChains = svc.getChainsByProtocol('evm');
    const expected = FIXTURE_CHAINS.filter((c) => c.protocol === 'evm').length;
    expect(evmChains).toHaveLength(expected);
    expect(evmChains.every((c) => c.protocol === 'evm')).toBe(true);
  });

  test('getChainsByProtocol("cosmos") returns Cosmos chains', () => {
    const cosmosChains = svc.getChainsByProtocol('cosmos');
    const expected = FIXTURE_CHAINS.filter((c) => c.protocol === 'cosmos').length;
    expect(cosmosChains).toHaveLength(expected);
    expect(cosmosChains.every((c) => c.protocol === 'cosmos')).toBe(true);
  });

  test('protocol filter returns correct subsets', () => {
    const solana = svc.listChains({ protocol: 'solana' });
    expect(solana).toHaveLength(1);
    expect(solana[0]!.slug).toBe('solana');

    const sui = svc.listChains({ protocol: 'sui' });
    expect(sui).toHaveLength(1);
    expect(sui[0]!.slug).toBe('sui');

    const near = svc.listChains({ protocol: 'near' });
    expect(near).toHaveLength(1);
    expect(near[0]!.slug).toBe('near');
  });

  test('CHAIN_REGISTRY_URL override is used when set', async () => {
    const customChain = {
      name: 'CustomChain',
      slug: 'custom',
      protocol: 'evm',
      url: 'https://custom.example.com',
      network: 'mainnet' as const,
    };
    const customRegistry = {
      version: '2.0.0',
      updated_at: '2026-01-01',
      gateway_base_url: 'https://example.com',
      chains: [customChain],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(customRegistry),
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('CHAIN_REGISTRY_URL', 'https://custom.example.com/chains.json');

    const remoteSvc = makeRegistry();
    await remoteSvc.init();

    expect(remoteSvc.listChains()).toHaveLength(1);
    expect(remoteSvc.getChain('custom')).not.toBeNull();
    expect(remoteSvc.getChain('custom')!.name).toBe('CustomChain');
    // Verify fetch was called with the custom URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.example.com/chains.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test('non-existent slug returns null', () => {
    expect(svc.getChain('does-not-exist')).toBeNull();
  });

  test('Radix returns status "inactive"', () => {
    expect(svc.getStatus('radix')).toBe('inactive');
  });

  test('listChains({ network: "testnet" }) returns only testnets', () => {
    const testnets = svc.listChains({ network: 'testnet' });
    const expected = FIXTURE_CHAINS.filter((c) => c.network === 'testnet').length;
    expect(testnets).toHaveLength(expected);
    expect(testnets.every((c) => c.network === 'testnet')).toBe(true);
  });

  test('updateStatus changes the reported status for a chain', () => {
    svc.updateStatus('eth', 'degraded');
    expect(svc.getStatus('eth')).toBe('degraded');
    svc.updateStatus('eth', 'active');
    expect(svc.getStatus('eth')).toBe('active');
  });

  test('getStatus returns "unknown" for a non-existent slug', () => {
    expect(svc.getStatus('no-such-chain')).toBe('unknown');
  });

  test('init throws when fetch fails (no silent fallback)', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', mockFetch);

    const failSvc = makeRegistry();
    await expect(failSvc.init()).rejects.toThrow('Failed to load chain registry');
  });

  test('init throws on non-ok HTTP response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', mockFetch);

    const failSvc = makeRegistry();
    await expect(failSvc.init()).rejects.toThrow('Registry fetch failed: HTTP 500');
  });

  test('default URL is the raw GitHub URL when CHAIN_REGISTRY_URL is not set', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(FIXTURE_REGISTRY),
    });
    vi.stubGlobal('fetch', mockFetch);
    delete process.env['CHAIN_REGISTRY_URL'];

    const defaultSvc = makeRegistry();
    await defaultSvc.init();

    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/pokt-network/public-rpc/main/supported-chains.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

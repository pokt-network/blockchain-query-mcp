/**
 * BlockchainQuery MCP — Chain Registry Service
 *
 * Fetches the supported chain list from the Pocket Network public-rpc repo at
 * startup.  The remote URL is the single source of truth; there is no bundled
 * fallback.  Set CHAIN_REGISTRY_URL to override the default GitHub raw URL.
 *
 * After loading, optional liveness probes run in the background to detect
 * degraded protocols.
 */

import type { ChainInfo, ChainRegistry } from '../types/index.js';

/** Default registry URL — raw GitHub content from the public-rpc repo. */
const DEFAULT_REGISTRY_URL =
  'https://raw.githubusercontent.com/pokt-network/public-rpc/main/supported-chains.json';

/** How long to wait when fetching the registry or running a liveness probe. */
const FETCH_TIMEOUT_MS = 5_000;

/** Per-protocol probe configurations. */
const PROBE_CONFIG: Record<string, { method: 'GET' | 'POST'; path?: string; rpc_method?: string }> = {
  evm: { method: 'POST', rpc_method: 'eth_chainId' },
  solana: { method: 'POST', rpc_method: 'getBlockHeight' },
  cosmos: { method: 'GET', path: '/cosmos/base/tendermint/v1beta1/blocks/latest' },
  sui: { method: 'POST', rpc_method: 'sui_getLatestCheckpointSequenceNumber' },
  near: { method: 'POST', rpc_method: 'status' },
};

export class ChainRegistryService {
  private chains: ChainInfo[] = [];
  private statusOverrides: Map<string, 'active' | 'inactive' | 'degraded'> = new Map();

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  /** Fetch the registry from the remote URL, then fire liveness probes. */
  async init(): Promise<void> {
    const url = (process.env['CHAIN_REGISTRY_URL'] ?? DEFAULT_REGISTRY_URL).trim();
    await this._loadRemote(url);

    // Fire-and-forget: do NOT await so that the first tool call is never blocked.
    void this.runLivenessProbes();
  }

  // -----------------------------------------------------------------------
  // Public query methods
  // -----------------------------------------------------------------------

  getChain(slug: string): ChainInfo | null {
    const chain = this.chains.find((c) => c.slug === slug);
    return chain ?? null;
  }

  listChains(filter?: { protocol?: string; network?: string; status?: string }): ChainInfo[] {
    let result = this.chains;

    if (filter?.protocol) {
      result = result.filter((c) => c.protocol === filter.protocol);
    }
    if (filter?.network) {
      result = result.filter((c) => c.network === filter.network);
    }
    if (filter?.status) {
      result = result.filter((c) => this.getStatus(c.slug) === filter.status);
    }

    return result;
  }

  getChainsByProtocol(protocol: string): ChainInfo[] {
    return this.chains.filter((c) => c.protocol === protocol);
  }

  getStatus(slug: string): string {
    // Runtime override takes precedence
    const override = this.statusOverrides.get(slug);
    if (override) return override;

    // Fall back to the status baked into the registry JSON
    const chain = this.chains.find((c) => c.slug === slug);
    if (!chain) return 'unknown';
    return chain.status ?? 'active';
  }

  updateStatus(slug: string, status: 'active' | 'inactive' | 'degraded'): void {
    this.statusOverrides.set(slug, status);
  }

  // -----------------------------------------------------------------------
  // Liveness probes
  // -----------------------------------------------------------------------

  async runLivenessProbes(): Promise<void> {
    const enabled = process.env['ENABLE_LIVENESS_PROBES'];
    if (enabled === 'false') return;

    // One representative mainnet chain per probeable protocol
    const probeTargets: ChainInfo[] = [];
    for (const protocol of Object.keys(PROBE_CONFIG)) {
      const candidate = this.chains.find(
        (c) => c.protocol === protocol && c.network === 'mainnet' && this.getStatus(c.slug) !== 'inactive',
      );
      if (candidate) probeTargets.push(candidate);
    }

    const results = await Promise.allSettled(
      probeTargets.map(async (chain) => {
        const cfg = PROBE_CONFIG[chain.protocol]!;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          let response: Response;

          if (cfg.method === 'GET') {
            const url = `${chain.url}${cfg.path ?? ''}`;
            response = await fetch(url, { signal: controller.signal });
          } else {
            const body = JSON.stringify({
              jsonrpc: '2.0',
              method: cfg.rpc_method!,
              params: [],
              id: 1,
            });
            response = await fetch(chain.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body,
              signal: controller.signal,
            });
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return { protocol: chain.protocol, ok: true };
        } catch (err) {
          return { protocol: chain.protocol, ok: false, error: err };
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    // Collect failed protocols
    const failedProtocols = new Set<string>();
    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value.ok) {
        failedProtocols.add(result.value.protocol);
      }
    }

    // Mark all chains belonging to a failed protocol as degraded
    for (const chain of this.chains) {
      if (failedProtocols.has(chain.protocol) && this.getStatus(chain.slug) !== 'inactive') {
        this.updateStatus(chain.slug, 'degraded');
      }
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private async _loadRemote(url: string): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Registry fetch failed: HTTP ${response.status}`);
      const registry = (await response.json()) as ChainRegistry;
      this.chains = registry.chains;
    } catch (err) {
      throw new Error(
        `Failed to load chain registry from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Singleton registry instance — call `registry.init()` once at startup. */
export const registry = new ChainRegistryService();

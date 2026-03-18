/**
 * update-badges.ts — Sync README badge counts with the live chain registry.
 *
 * Fetches the Pocket Network public-rpc supported-chains.json, counts active
 * chains and unique protocols, then rewrites the shields.io badge URLs in
 * README.md.  Exits 0 even on failure so it never blocks a release.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REGISTRY_URL =
  'https://raw.githubusercontent.com/pokt-network/public-rpc/main/supported-chains.json';

const README_PATH = resolve(__dirname, '..', 'README.md');

interface Chain {
  protocol: string;
  status?: string;
}

interface Registry {
  chains: Chain[];
}

async function main(): Promise<void> {
  // Fetch registry
  const response = await fetch(REGISTRY_URL);
  if (!response.ok) throw new Error(`Registry fetch failed: HTTP ${response.status}`);
  const registry = (await response.json()) as Registry;

  // Count active chains and unique protocols
  const active = registry.chains.filter((c) => c.status !== 'inactive');
  const chainCount = active.length;
  const protocolCount = new Set(active.map((c) => c.protocol)).size;

  console.log(`Registry: ${chainCount} active chains, ${protocolCount} protocols`);

  // Read README and replace badge URLs
  let readme = readFileSync(README_PATH, 'utf-8');

  const chainBadgeRe = /!\[\d+ Chains\]\(https:\/\/img\.shields\.io\/badge\/chains-\d+-/;
  const protocolBadgeRe = /!\[\d+ Protocols\]\(https:\/\/img\.shields\.io\/badge\/protocols-\d+-/;

  const newChainBadge = `![${chainCount} Chains](https://img.shields.io/badge/chains-${chainCount}-`;
  const newProtocolBadge = `![${protocolCount} Protocols](https://img.shields.io/badge/protocols-${protocolCount}-`;

  const updated = readme
    .replace(chainBadgeRe, newChainBadge)
    .replace(protocolBadgeRe, newProtocolBadge);

  if (updated === readme) {
    console.log('Badges already up to date.');
    return;
  }

  writeFileSync(README_PATH, updated, 'utf-8');
  console.log('README.md badges updated.');
}

main().catch((err) => {
  console.error('Badge update failed (non-fatal):', err instanceof Error ? err.message : err);
  process.exit(0); // best-effort — never block the release
});

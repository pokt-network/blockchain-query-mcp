/**
 * BlockchainQuery MCP — Domain Resolver
 *
 * Resolves blockchain domain names to addresses.
 *   - ENS (.eth)  via Ethereum mainnet
 *   - Unstoppable Domains (.crypto, .nft, .blockchain, etc.) via Polygon mainnet
 *
 * Ported from the legacy DomainResolverService; replaces hardcoded service IDs
 * with chain-registry lookups and the legacy blockchainService with dispatchJsonRpc.
 */

import { registry } from './chain-registry.js';
import { dispatchJsonRpc } from './rpc-dispatcher.js';
import { ENS_REGISTRY, UD_PROXY_READER } from '../utils/constants.js';
import type { RpcResponse } from '../types/index.js';
import pkg from 'js-sha3';

const { keccak256: keccakHash } = pkg;

// ---------------------------------------------------------------------------
// TLD detection
// ---------------------------------------------------------------------------

/** Returns true when the domain belongs to one of the Unstoppable Domains TLDs. */
function isUnstoppableDomain(domain: string): boolean {
  const udTLDs = [
    '.crypto', '.nft', '.blockchain', '.bitcoin', '.coin',
    '.wallet', '.888', '.dao', '.x', '.zil',
  ];
  return udTLDs.some((tld) => domain.endsWith(tld));
}

// ---------------------------------------------------------------------------
// EIP-137 namehash
// ---------------------------------------------------------------------------

/**
 * Compute the EIP-137 namehash for a domain.
 * Uses keccakHash (js-sha3) with Buffer-based hex concatenation.
 */
function namehash(domain: string): string {
  let node = '0000000000000000000000000000000000000000000000000000000000000000';

  if (domain) {
    const labels = domain.split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = keccakHash(labels[i]!);
      node = keccakHash(Buffer.from(node + labelHash, 'hex'));
    }
  }

  return '0x' + node;
}

// ---------------------------------------------------------------------------
// ABI encoding helpers
// ---------------------------------------------------------------------------

/** Encode resolver(bytes32) call — function selector 0x0178b8bf */
function encodeResolverCall(hash: string): string {
  const functionSig = '0x0178b8bf';
  const paddedHash = hash.slice(2).padStart(64, '0');
  return functionSig + paddedHash;
}

/** Encode addr(bytes32) call — function selector 0x3b3b57de */
function encodeAddrCall(hash: string): string {
  const functionSig = '0x3b3b57de';
  const paddedHash = hash.slice(2).padStart(64, '0');
  return functionSig + paddedHash;
}

/**
 * Encode getMany(string[] keys, uint256 tokenId) call for Unstoppable Domains.
 * Function selector: 0x1bd8cc1a
 */
function encodeGetManyCall(keys: string[], tokenId: string): string {
  const functionSig = '0x1bd8cc1a';

  // First param: offset to the keys array (64 bytes after the two top-level pointers)
  const arrayOffset = '0000000000000000000000000000000000000000000000000000000000000040';

  // Second param: tokenId
  const paddedTokenId = tokenId.slice(2).padStart(64, '0');

  // Array header: length
  const arrayLength = keys.length.toString(16).padStart(64, '0');

  // Per-element offset pointers (relative to start of array data, i.e. after the length word)
  let encodedKeys = '';
  let dataOffset = keys.length * 32; // each pointer word is 32 bytes

  for (const key of keys) {
    encodedKeys += dataOffset.toString(16).padStart(64, '0');
    dataOffset += 32 + Math.ceil(key.length / 32) * 32; // length word + padded data
  }

  // Per-element string data
  for (const key of keys) {
    const keyLength = key.length.toString(16).padStart(64, '0');
    const keyHex = Buffer.from(key, 'utf8')
      .toString('hex')
      .padEnd(Math.ceil(key.length / 32) * 64, '0');
    encodedKeys += keyLength + keyHex;
  }

  return functionSig + arrayOffset + paddedTokenId + arrayLength + encodedKeys;
}

// ---------------------------------------------------------------------------
// ABI decoding helpers
// ---------------------------------------------------------------------------

/**
 * Decode a single ABI-encoded string return value.
 * Layout: [offset(32)] [length(32)] [data(padded)]
 */
function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return '';

    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

    // Bytes 0-63: offset to string data (we skip it — data always follows)
    const lengthHex = cleanHex.slice(64, 128);
    const length = parseInt(lengthHex, 16);

    if (length === 0) return '';

    const dataHex = cleanHex.slice(128, 128 + length * 2);
    return Buffer.from(dataHex, 'hex').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Decode the getMany(string[]) response and return the first element.
 */
function decodeGetManyResponse(data: string): string {
  try {
    const hex = data.slice(2); // strip '0x'

    // Top-level offset to array data
    const arrayOffset = parseInt(hex.slice(0, 64), 16) * 2;

    // Array length
    const arrayLength = parseInt(hex.slice(arrayOffset, arrayOffset + 64), 16);
    if (arrayLength === 0) return '';

    // Offset (relative to start of array payload) to first string
    const firstStringRelOffset =
      parseInt(hex.slice(arrayOffset + 64, arrayOffset + 128), 16) * 2;
    const firstStringOffset = arrayOffset + firstStringRelOffset;

    // String length
    const stringLength = parseInt(hex.slice(firstStringOffset, firstStringOffset + 64), 16);
    if (stringLength === 0) return '';

    // String data
    const stringData = hex.slice(
      firstStringOffset + 64,
      firstStringOffset + 64 + stringLength * 2,
    );

    return Buffer.from(stringData, 'hex').toString('utf8');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// ENS resolution
// ---------------------------------------------------------------------------

async function resolveENS(domain: string): Promise<RpcResponse> {
  try {
    const ethChain = registry.getChain('eth');
    if (!ethChain) {
      return { success: false, error: `Chain 'eth' not found in registry.` };
    }

    const hash = namehash(domain);

    // Step 1: resolve(bytes32) → resolver address
    const resolverCallData = encodeResolverCall(hash);
    const resolverRaw = await dispatchJsonRpc(ethChain.url, 'eth_call', [
      { to: ENS_REGISTRY, data: resolverCallData },
      'latest',
    ]);

    const resolverHex = resolverRaw as string;
    if (!resolverHex) {
      return { success: false, error: `Failed to get resolver for ${domain}` };
    }

    const resolverAddress = '0x' + resolverHex.slice(-40);
    if (resolverAddress === '0x0000000000000000000000000000000000000000') {
      return { success: false, error: `No resolver set for ${domain}` };
    }

    // Step 2: addr(bytes32) → address
    const addrCallData = encodeAddrCall(hash);
    const addrRaw = await dispatchJsonRpc(ethChain.url, 'eth_call', [
      { to: resolverAddress, data: addrCallData },
      'latest',
    ]);

    const addrHex = addrRaw as string;
    if (!addrHex) {
      return { success: false, error: `Failed to resolve address for ${domain}` };
    }

    const address = '0x' + addrHex.slice(-40);
    if (address === '0x0000000000000000000000000000000000000000') {
      return { success: false, error: `No address set for ${domain}` };
    }

    return {
      success: true,
      data: { domain, address, type: 'ENS' },
      chain: ethChain.slug,
      method: 'eth_call',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error resolving ENS domain';
    return { success: false, error };
  }
}

// ---------------------------------------------------------------------------
// Unstoppable Domains resolution
// ---------------------------------------------------------------------------

async function resolveUnstoppableDomain(domain: string): Promise<RpcResponse> {
  try {
    const polyChain = registry.getChain('poly');
    if (!polyChain) {
      return { success: false, error: `Chain 'poly' not found in registry.` };
    }

    const tokenId = namehash(domain);
    const keys = ['crypto.ETH.address'];
    const callData = encodeGetManyCall(keys, tokenId);

    const raw = await dispatchJsonRpc(polyChain.url, 'eth_call', [
      { to: UD_PROXY_READER, data: callData },
      'latest',
    ]);

    const responseHex = raw as string;
    if (!responseHex) {
      return {
        success: false,
        error: `Failed to resolve Unstoppable Domain ${domain}`,
      };
    }

    const address = decodeGetManyResponse(responseHex);
    if (!address || address === '0x0000000000000000000000000000000000000000') {
      return { success: false, error: `No address set for ${domain}` };
    }

    return {
      success: true,
      data: { domain, address, type: 'Unstoppable Domains' },
      chain: polyChain.slug,
      method: 'eth_call',
    };
  } catch (err) {
    const error =
      err instanceof Error ? err.message : 'Unknown error resolving Unstoppable Domain';
    return { success: false, error };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a blockchain domain name to an Ethereum address.
 *
 * Supported domain types:
 *  - `.eth`                    — ENS (Ethereum Name Service)
 *  - `.crypto`, `.nft`, `.blockchain`, `.bitcoin`, `.coin`,
 *    `.wallet`, `.888`, `.dao`, `.x`, `.zil`  — Unstoppable Domains
 */
async function resolveDomain(domain: string): Promise<RpcResponse> {
  const domainLower = domain.toLowerCase().trim();

  if (domainLower.endsWith('.eth')) {
    return resolveENS(domainLower);
  }

  if (isUnstoppableDomain(domainLower)) {
    return resolveUnstoppableDomain(domainLower);
  }

  return {
    success: false,
    error: [
      `Unsupported domain type: ${domain}.`,
      `Supported: .eth (ENS);`,
      `.crypto, .nft, .blockchain, .bitcoin, .coin, .wallet, .888, .dao, .x, .zil (Unstoppable Domains)`,
    ].join(' '),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const domainResolver = { resolveDomain };

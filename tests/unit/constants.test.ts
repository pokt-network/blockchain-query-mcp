import { describe, test, expect } from 'vitest';
import {
  ERC20_SELECTORS,
  ADDRESS_PATTERNS,
  UNIT_SYSTEMS,
  DANGEROUS_METHODS,
} from '../../server/utils/constants.js';

// ---------------------------------------------------------------------------
// ERC-20 selectors
// ---------------------------------------------------------------------------

describe('Constants — ERC20_SELECTORS', () => {
  test('ERC-20 selectors are 4-byte hex strings (0x + 8 hex chars = 10 chars total)', () => {
    for (const [key, selector] of Object.entries(ERC20_SELECTORS)) {
      expect(selector, `${key} should start with 0x`).toMatch(/^0x/);
      expect(selector.length, `${key} should be 10 characters`).toBe(10);
      expect(selector, `${key} should be a valid hex string`).toMatch(/^0x[0-9a-fA-F]{8}$/);
    }
  });

  test('has selectors for balanceOf, decimals, symbol, name, totalSupply', () => {
    expect(ERC20_SELECTORS.balanceOf).toBe('0x70a08231');
    expect(ERC20_SELECTORS.decimals).toBe('0x313ce567');
    expect(ERC20_SELECTORS.symbol).toBe('0x95d89b41');
    expect(ERC20_SELECTORS.name).toBe('0x06fdde03');
    expect(ERC20_SELECTORS.totalSupply).toBe('0x18160ddd');
  });
});

// ---------------------------------------------------------------------------
// Address patterns
// ---------------------------------------------------------------------------

describe('Constants — ADDRESS_PATTERNS', () => {
  test('EVM pattern matches a valid checksummed Ethereum address', () => {
    expect(ADDRESS_PATTERNS.evm.test('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68')).toBe(true);
  });

  test('EVM pattern matches a lowercase Ethereum address', () => {
    expect(ADDRESS_PATTERNS.evm.test('0x742d35cc6634c0532925a3b844bc9e7595f2bd68')).toBe(true);
  });

  test('EVM pattern rejects an invalid address', () => {
    expect(ADDRESS_PATTERNS.evm.test('not-an-address')).toBe(false);
    expect(ADDRESS_PATTERNS.evm.test('0x742d35')).toBe(false); // too short
    expect(ADDRESS_PATTERNS.evm.test('742d35Cc6634C0532925a3b844Bc9e7595f2bD68')).toBe(false); // missing 0x
  });

  test('Solana pattern matches a valid base58 public key', () => {
    // 44-char base58 — typical Solana address
    expect(ADDRESS_PATTERNS.solana.test('So11111111111111111111111111111111111111112')).toBe(true);
    expect(ADDRESS_PATTERNS.solana.test('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')).toBe(true);
  });

  test('Solana pattern rejects addresses with disallowed base58 characters', () => {
    // base58 excludes 0, O, I, l
    expect(ADDRESS_PATTERNS.solana.test('0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false);
  });

  test('Cosmos pattern matches osmo1-style bech32 addresses', () => {
    // 39-char suffix → 41 chars total after 'osmo1'
    const osmosisAddr = 'osmo1' + 'a'.repeat(39);
    expect(ADDRESS_PATTERNS.cosmos.test(osmosisAddr)).toBe(true);
  });

  test('Cosmos pattern rejects non-bech32 strings', () => {
    expect(ADDRESS_PATTERNS.cosmos.test('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD68')).toBe(false);
    expect(ADDRESS_PATTERNS.cosmos.test('COSMOS1abcdef')).toBe(false); // uppercase
  });
});

// ---------------------------------------------------------------------------
// Unit systems
// ---------------------------------------------------------------------------

describe('Constants — UNIT_SYSTEMS', () => {
  test('EVM unit system uses 1e18 as divisor', () => {
    expect(UNIT_SYSTEMS.evm).toBeDefined();
    expect(UNIT_SYSTEMS.evm!.divisor).toBe(BigInt('1000000000000000000'));
    expect(UNIT_SYSTEMS.evm!.base).toBe('wei');
    expect(UNIT_SYSTEMS.evm!.display).toBe('ETH');
  });

  test('Solana unit system uses 1e9 as divisor', () => {
    expect(UNIT_SYSTEMS.solana).toBeDefined();
    expect(UNIT_SYSTEMS.solana!.divisor).toBe(BigInt('1000000000'));
    expect(UNIT_SYSTEMS.solana!.base).toBe('lamports');
    expect(UNIT_SYSTEMS.solana!.display).toBe('SOL');
  });

  test('Tron unit system uses 1e6 as divisor', () => {
    expect(UNIT_SYSTEMS.tron).toBeDefined();
    expect(UNIT_SYSTEMS.tron!.divisor).toBe(BigInt('1000000'));
  });

  test('NEAR unit system uses 1e24 as divisor', () => {
    expect(UNIT_SYSTEMS.near).toBeDefined();
    expect(UNIT_SYSTEMS.near!.divisor).toBe(BigInt('1000000000000000000000000'));
  });
});

// ---------------------------------------------------------------------------
// Dangerous methods
// ---------------------------------------------------------------------------

describe('Constants — DANGEROUS_METHODS', () => {
  test('dangerous methods list has exactly 4 entries', () => {
    expect(DANGEROUS_METHODS).toHaveLength(4);
  });

  test('dangerous methods list includes the expected debug/trace methods', () => {
    const methods = DANGEROUS_METHODS as readonly string[];
    expect(methods).toContain('debug_traceTransaction');
    expect(methods).toContain('debug_traceCall');
    expect(methods).toContain('debug_storageRangeAt');
    expect(methods).toContain('trace_block');
  });
});

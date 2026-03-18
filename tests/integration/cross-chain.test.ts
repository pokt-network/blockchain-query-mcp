import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { domainResolver } from '../../server/services/domain-resolver.js';
import { preCheck } from '../../server/utils/safety-checks.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Cross-Chain Integration', () => {
  // -------------------------------------------------------------------------
  // Safety-check unit tests (no network calls)
  // -------------------------------------------------------------------------

  test('compare_balances safety check rejects more than 5 chains', () => {
    const result = preCheck('compare_balances', [['eth', 'arb-one', 'base', 'poly', 'op', 'avax']]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('5');
  });

  test('compare_balances safety check allows exactly 5 chains', () => {
    const result = preCheck('compare_balances', [['eth', 'arb-one', 'base', 'poly', 'op']]);
    expect(result.allowed).toBe(true);
  });

  test('compare_balances safety check allows fewer than 5 chains', () => {
    const result = preCheck('compare_balances', [['eth', 'arb-one']]);
    expect(result.allowed).toBe(true);
  });

  // -------------------------------------------------------------------------
  // convert_units — pure math, no network calls
  // -------------------------------------------------------------------------

  test('convert_units: 1 ETH equals 1000000000000000000 wei (round-trip)', async () => {
    // Exercise the convert_units handler directly via the cross-chain handler module
    const { registerTools } = await import('../../server/handlers/cross-chain-handlers.js');
    const tools = registerTools();
    const convertTool = tools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const result = await convertTool!.handler({
      value: '1',
      from_unit: 'ETH',
      to_unit: 'wei',
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as {
      output: { value: string; unit: string };
    };
    expect(parsed.output.value).toBe('1000000000000000000');
    expect(parsed.output.unit).toBe('wei');
  });

  test('convert_units: 1000000000000000000 wei equals 1 ETH', async () => {
    const { registerTools } = await import('../../server/handlers/cross-chain-handlers.js');
    const tools = registerTools();
    const convertTool = tools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const result = await convertTool!.handler({
      value: '1000000000000000000',
      from_unit: 'wei',
      to_unit: 'ETH',
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as {
      output: { value: string; unit: string };
    };
    expect(parsed.output.value).toBe('1');
    expect(parsed.output.unit).toBe('ETH');
  });

  test('convert_units: 1 SOL equals 1000000000 lamports', async () => {
    const { registerTools } = await import('../../server/handlers/cross-chain-handlers.js');
    const tools = registerTools();
    const convertTool = tools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const result = await convertTool!.handler({
      value: '1',
      from_unit: 'SOL',
      to_unit: 'lamports',
    });

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse(result.content[0]!.text) as {
      output: { value: string; unit: string };
    };
    expect(parsed.output.value).toBe('1000000000');
  });

  test('convert_units: cross-protocol conversion returns error', async () => {
    const { registerTools } = await import('../../server/handlers/cross-chain-handlers.js');
    const tools = registerTools();
    const convertTool = tools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const result = await convertTool!.handler({
      value: '1',
      from_unit: 'ETH',
      to_unit: 'SOL',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Error');
  });

  // -------------------------------------------------------------------------
  // ENS domain resolution — live network call
  // -------------------------------------------------------------------------

  test('resolve_domain resolves vitalik.eth to an Ethereum address', async () => {
    // vitalik.eth is the most stable ENS name and will always resolve
    const result = await domainResolver.resolveDomain('vitalik.eth');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(typeof data['address']).toBe('string');
    // Must be a valid 0x-prefixed Ethereum address
    expect((data['address'] as string).startsWith('0x')).toBe(true);
    expect((data['address'] as string).length).toBe(42);
    expect(data['type']).toBe('ENS');
  }, 30000);
});

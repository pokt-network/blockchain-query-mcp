import { describe, test, expect, beforeAll } from 'vitest';
import { registerTools as registerDiscoveryTools } from '../../server/handlers/discovery-handlers.js';
import { registerTools as registerEvmTools } from '../../server/handlers/evm-handlers.js';
import { registerTools as registerSolanaTools } from '../../server/handlers/solana-handlers.js';
import { registerTools as registerCosmosTools } from '../../server/handlers/cosmos-handlers.js';
import { registerTools as registerSuiTools } from '../../server/handlers/sui-handlers.js';
import { registerTools as registerNearTools } from '../../server/handlers/near-handlers.js';
import { registerTools as registerRadixTools } from '../../server/handlers/radix-handlers.js';
import { registerTools as registerCrossChainTools } from '../../server/handlers/cross-chain-handlers.js';
import { registry } from '../../server/services/chain-registry.js';

// Collect all tools once at module load so they are available in every test
const allTools = [
  ...registerDiscoveryTools(),
  ...registerEvmTools(),
  ...registerSolanaTools(),
  ...registerCosmosTools(),
  ...registerSuiTools(),
  ...registerNearTools(),
  ...registerRadixTools(),
  ...registerCrossChainTools(),
];

// The canonical list of all 32 tool names declared in manifest.json
const EXPECTED_TOOL_NAMES = [
  'list_chains',
  'get_chain_info',
  'evm_call',
  'evm_get_balance',
  'evm_get_block',
  'evm_get_transaction',
  'evm_get_receipt',
  'evm_get_logs',
  'evm_estimate_gas',
  'evm_get_token_info',
  'evm_call_contract',
  'solana_get_balance',
  'solana_get_account',
  'solana_get_block',
  'solana_get_transaction',
  'solana_get_signatures',
  'cosmos_get_balance',
  'cosmos_get_staking',
  'cosmos_get_validators',
  'cosmos_get_transaction',
  'cosmos_get_governance',
  'cosmos_get_block',
  'sui_get_balance',
  'sui_get_object',
  'sui_get_transaction',
  'sui_get_coins',
  'near_query',
  'near_get_block',
  'near_get_transaction',
  'radix_get_network_status',
  'radix_get_network_config',
  'radix_get_balance',
  'radix_get_transaction_status',
  'radix_get_consensus_manager',
  'resolve_domain',
  'compare_balances',
  'convert_units',
] as const;

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Smoke Tests — All 37 Tools', () => {
  // -------------------------------------------------------------------------
  // Registration completeness
  // -------------------------------------------------------------------------

  test('all 37 tools appear in the combined tool listing', () => {
    expect(allTools).toHaveLength(37);
  });

  test('all expected tool names are present in the listing', () => {
    const registeredNames = allTools.map((t) => t.definition.name);
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(registeredNames).toContain(name);
    }
  });

  test('no duplicate tool names are registered', () => {
    const names = allTools.map((t) => t.definition.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  // -------------------------------------------------------------------------
  // Schema shape validation — every tool must have the required fields
  // -------------------------------------------------------------------------

  test.each(allTools.map((t) => [t.definition.name, t] as const))(
    'tool "%s" has name, description, and inputSchema with type object',
    (_name, tool) => {
      expect(typeof tool.definition.name).toBe('string');
      expect(tool.definition.name.length).toBeGreaterThan(0);

      expect(typeof tool.definition.description).toBe('string');
      expect(tool.definition.description.length).toBeGreaterThan(0);

      expect(tool.definition.inputSchema).toBeDefined();
      expect(tool.definition.inputSchema.type).toBe('object');
      expect(typeof tool.definition.inputSchema.properties).toBe('object');

      expect(typeof tool.handler).toBe('function');
    },
  );

  // -------------------------------------------------------------------------
  // Live handler invocations — discovery tools only (fast, no heavy RPC calls)
  // -------------------------------------------------------------------------

  test('list_chains returns data without error', async () => {
    const listChainsTool = allTools.find((t) => t.definition.name === 'list_chains');
    expect(listChainsTool).toBeDefined();

    const response = await listChainsTool!.handler({});
    expect(response.isError).toBeFalsy();
    expect(response.content).toHaveLength(1);
    expect(response.content[0]!.type).toBe('text');

    const parsed = JSON.parse(response.content[0]!.text) as {
      chains: unknown[];
      total: number;
    };
    expect(Array.isArray(parsed.chains)).toBe(true);
    expect(parsed.chains.length).toBeGreaterThan(0);
    expect(parsed.total).toBe(parsed.chains.length);
  }, 30000);

  test('get_chain_info returns data for chain slug "eth"', async () => {
    const getChainInfoTool = allTools.find((t) => t.definition.name === 'get_chain_info');
    expect(getChainInfoTool).toBeDefined();

    const response = await getChainInfoTool!.handler({ chain: 'eth' });
    expect(response.isError).toBeFalsy();

    const parsed = JSON.parse(response.content[0]!.text) as Record<string, unknown>;
    expect(parsed['slug']).toBe('eth');
    expect(parsed['protocol']).toBe('evm');
    expect(Array.isArray(parsed['supported_methods'])).toBe(true);
  }, 30000);

  test('get_chain_info returns an error for an unknown chain slug', async () => {
    const getChainInfoTool = allTools.find((t) => t.definition.name === 'get_chain_info');
    expect(getChainInfoTool).toBeDefined();

    const response = await getChainInfoTool!.handler({ chain: 'not-a-real-chain-xyz' });
    expect(response.isError).toBe(true);
  });

  test('get_chain_info returns an error when chain param is missing', async () => {
    const getChainInfoTool = allTools.find((t) => t.definition.name === 'get_chain_info');
    expect(getChainInfoTool).toBeDefined();

    const response = await getChainInfoTool!.handler({});
    expect(response.isError).toBe(true);
  });

  test('list_chains can filter by protocol "evm"', async () => {
    const listChainsTool = allTools.find((t) => t.definition.name === 'list_chains');
    expect(listChainsTool).toBeDefined();

    const response = await listChainsTool!.handler({ protocol: 'evm' });
    expect(response.isError).toBeFalsy();

    const parsed = JSON.parse(response.content[0]!.text) as {
      chains: Array<{ protocol: string }>;
      total: number;
    };
    expect(parsed.chains.length).toBeGreaterThan(0);
    for (const chain of parsed.chains) {
      expect(chain.protocol).toBe('evm');
    }
  }, 30000);

  test('list_chains can filter by network "mainnet"', async () => {
    const listChainsTool = allTools.find((t) => t.definition.name === 'list_chains');
    expect(listChainsTool).toBeDefined();

    const response = await listChainsTool!.handler({ network: 'mainnet' });
    expect(response.isError).toBeFalsy();

    const parsed = JSON.parse(response.content[0]!.text) as {
      chains: Array<{ network: string }>;
    };
    expect(parsed.chains.length).toBeGreaterThan(0);
    for (const chain of parsed.chains) {
      expect(chain.network).toBe('mainnet');
    }
  }, 30000);

  // -------------------------------------------------------------------------
  // convert_units — registered and callable without network access
  // -------------------------------------------------------------------------

  test('convert_units tool is registered and handles a valid conversion', async () => {
    const convertTool = allTools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const response = await convertTool!.handler({
      value: '1',
      from_unit: 'ETH',
      to_unit: 'wei',
    });

    expect(response.isError).toBeFalsy();
    const parsed = JSON.parse(response.content[0]!.text) as {
      input: { value: string; unit: string };
      output: { value: string; unit: string };
    };
    expect(parsed.input.value).toBe('1');
    expect(parsed.output.value).toBe('1000000000000000000');
  });

  test('convert_units tool returns error for unknown unit', async () => {
    const convertTool = allTools.find((t) => t.definition.name === 'convert_units');
    expect(convertTool).toBeDefined();

    const response = await convertTool!.handler({
      value: '1',
      from_unit: 'UNKNOWN_UNIT',
      to_unit: 'wei',
    });

    expect(response.isError).toBe(true);
  });

  // -------------------------------------------------------------------------
  // compare_balances — safety check enforced at handler level (no network call)
  // -------------------------------------------------------------------------

  test('compare_balances handler rejects more than 5 chains without network call', async () => {
    const compareTool = allTools.find((t) => t.definition.name === 'compare_balances');
    expect(compareTool).toBeDefined();

    const response = await compareTool!.handler({
      address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      chains: ['eth', 'arb-one', 'base', 'poly', 'op', 'avax'],
    });

    expect(response.isError).toBe(true);
    expect(response.content[0]!.text).toContain('Error');
  });
});

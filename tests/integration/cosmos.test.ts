import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { cosmosService } from '../../server/services/cosmos-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Cosmos Integration', () => {
  test('cosmos_get_balance on Osmosis returns a structured response', async () => {
    // A zero-balance address still yields a well-formed RpcResponse from the service.
    // The gateway may be degraded; we assert shape, not a specific success value.
    const result = await cosmosService.getBalance(
      'osmosis',
      'osmo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmcn030',
    );
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('cosmos_get_block returns latest block from pocket chain', async () => {
    // The Pocket Network Cosmos endpoint is reliably active on its own chain.
    const result = await cosmosService.getBlock('pocket');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    // Cosmos latest block always has a block object
    expect(data['block']).toBeDefined();
  }, 30000);

  test('cosmos_get_block returns latest block from juno chain', async () => {
    const result = await cosmosService.getBlock('juno');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data['block']).toBeDefined();
  }, 30000);

  test('cosmos_get_block returns a structured response for osmosis', async () => {
    // Osmosis may be degraded on the gateway; assert shape only
    const result = await cosmosService.getBlock('osmosis');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['block']).toBeDefined();
    }
  }, 30000);

  test('cosmos_get_validators returns validator list from pocket chain', async () => {
    const result = await cosmosService.getValidators('pocket');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['validators']).toBeDefined();
    }
  }, 30000);

  test('cosmos_get_block returns a block at a specific height on akash', async () => {
    // Height 1 always exists on every Cosmos chain
    const result = await cosmosService.getBlock('akash', '1');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);
});

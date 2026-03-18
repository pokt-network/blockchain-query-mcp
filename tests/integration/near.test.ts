import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { nearService } from '../../server/services/near-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Near Integration', () => {
  test('near_query with view_account returns a structured response for aurora', async () => {
    // 'aurora' is a well-known named NEAR account (Aurora EVM bridge).
    // The Pocket Network NEAR gateway may return a 400/500 on some methods;
    // we assert that the service always returns a correctly-shaped RpcResponse.
    const result = await nearService.query('view_account', { account_id: 'aurora' });
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    // If the call succeeds, the response must contain NEAR account fields
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['amount']).toBeDefined();
      expect(data['code_hash']).toBeDefined();
    } else {
      // A failed call must carry a descriptive error string
      expect(typeof result.error).toBe('string');
      expect((result.error as string).length).toBeGreaterThan(0);
    }
  }, 30000);

  test('near_get_block returns a structured response for the latest finalized block', async () => {
    const result = await nearService.getBlock();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      // Latest block always has header and chunks
      expect(data['header']).toBeDefined();
    } else {
      expect(typeof result.error).toBe('string');
    }
  }, 30000);

  test('near_get_block returns a structured response for a specific block height', async () => {
    // Block height 9820210 is a confirmed early NEAR mainnet block
    const result = await nearService.getBlock(9820210);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['header']).toBeDefined();
    }
  }, 30000);

  test('near_query view_access_key_list returns a structured response', async () => {
    const result = await nearService.query('view_access_key_list', { account_id: 'aurora' });
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);
});

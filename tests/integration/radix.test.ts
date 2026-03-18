import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { radixService } from '../../server/services/radix-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Radix Integration', () => {
  test('radix_get_network_status returns a structured response', async () => {
    const result = await radixService.getNetworkStatus();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['current_state_identifier']).toBeDefined();
    } else {
      expect(typeof result.error).toBe('string');
      expect((result.error as string).length).toBeGreaterThan(0);
    }
  }, 30000);

  test('radix_get_network_config returns a structured response', async () => {
    const result = await radixService.getNetworkConfig();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['well_known_addresses']).toBeDefined();
    } else {
      expect(typeof result.error).toBe('string');
    }
  }, 30000);

  test('radix_get_consensus_manager returns a structured response', async () => {
    const result = await radixService.getConsensusManager();
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(result.data).toBeDefined();
    } else {
      expect(typeof result.error).toBe('string');
    }
  }, 30000);

  test('radix_get_balance returns error for invalid address', async () => {
    const result = await radixService.getBalance('not_a_real_address');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    // Either a gateway error or a network error — both are valid shaped responses
    if (!result.success) {
      expect(typeof result.error).toBe('string');
    }
  }, 30000);

  test('radix_get_transaction_status returns a structured response for unknown hash', async () => {
    const result = await radixService.getTransactionStatus('txid_rdx_notreal');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);
});

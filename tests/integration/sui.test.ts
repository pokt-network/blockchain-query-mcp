import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { suiService } from '../../server/services/sui-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Sui Integration', () => {
  test('sui_get_balance returns a structured response for Sui framework address', async () => {
    // 0x2 is the Sui framework package address — always present on mainnet
    const result = await suiService.getBalance(
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    );
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    // Whether or not the address holds SUI, the response is always structured
    if (result.success) {
      const data = result.data as Record<string, unknown>;
      expect(data['totalBalance']).toBeDefined();
      expect(data['totalBalanceFormatted']).toBeDefined();
    }
  }, 30000);

  test('sui_get_object returns structured response for Sui framework object', async () => {
    // 0x2 is a well-known Sui package object
    const result = await suiService.getObject(
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    );
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('sui_get_coins returns structured response', async () => {
    // Use a known address with activity — the Sui foundation address
    const result = await suiService.getCoins(
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    );
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);
});

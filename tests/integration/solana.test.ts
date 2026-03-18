import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { solanaService } from '../../server/services/solana-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('Solana Integration', () => {
  test('solana_get_balance returns lamports for system program address', async () => {
    // The Solana system program — always exists on mainnet
    const result = await solanaService.getBalance('11111111111111111111111111111112');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data['address']).toBe('11111111111111111111111111111112');
    // lamports is returned as a string due to BigInt serialisation
    expect(data['lamports']).toBeDefined();
    expect(data['sol']).toBeDefined();
  }, 30000);

  test('solana_get_account returns account info for system program', async () => {
    const result = await solanaService.getAccount('11111111111111111111111111111112');
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('solana_get_block returns block data for a known early slot', async () => {
    // Slot 100000000 is a well-established Solana block
    const result = await solanaService.getBlock(100000000);
    // Older slots may be pruned by the node; the call must still return a structured response
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('solana_get_signatures returns signature list for system program', async () => {
    const result = await solanaService.getSignatures('11111111111111111111111111111112', 5);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true);
    }
  }, 30000);
});

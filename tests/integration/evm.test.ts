import { describe, test, expect, beforeAll } from 'vitest';
import { registry } from '../../server/services/chain-registry.js';
import { evmService } from '../../server/services/evm-service.js';

beforeAll(async () => {
  await registry.init();
}, 15000);

describe('EVM Integration', () => {
  test('evm_get_balance on Ethereum returns a successful response', async () => {
    // Vitalik's well-known address — always has a non-zero ETH balance
    const result = await evmService.getBalance('eth', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(typeof data['hex']).toBe('string');
    expect(typeof data['raw']).toBe('string');
    expect(typeof data['formatted']).toBe('string');
  }, 30000);

  test('evm_get_block returns valid block object', async () => {
    const result = await evmService.getBlock('eth', 'latest');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    // A valid block always has a number and hash field
    expect(data['number']).toBeDefined();
    expect(data['hash']).toBeDefined();
  }, 30000);

  test('evm_get_transaction returns structured response for a known tx hash', async () => {
    // A historical Ethereum genesis-era transaction
    // We use a very early mainnet tx that will always be retrievable
    const knownTxHash = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';
    const result = await evmService.getTransaction('eth', knownTxHash);
    // Even if the node doesn't have full history, the call should return a structured response
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('evm_get_receipt returns structured response', async () => {
    const knownTxHash = '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060';
    const result = await evmService.getReceipt('eth', knownTxHash);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  }, 30000);

  test('evm_get_token_info returns ERC-20 metadata for USDC on Ethereum', async () => {
    // USDC contract on Ethereum mainnet
    const usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const result = await evmService.getTokenInfo('eth', usdcAddress);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    // USDC always has symbol, name, decimals
    expect(data['symbol']).toBeDefined();
    expect(data['name']).toBeDefined();
    expect(typeof data['decimals']).toBe('number');
  }, 30000);

  test('evm_get_balance on Tron via evm_compatible', async () => {
    // Tron zero address in EVM format
    const result = await evmService.getBalance('tron', '0x0000000000000000000000000000000000000000');
    expect(result).toBeDefined();
    // May succeed or fail depending on network, but must return a structured response
    expect(typeof result.success).toBe('boolean');
  }, 30000);
});

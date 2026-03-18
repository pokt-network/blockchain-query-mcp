import { describe, test, expect } from 'vitest';
import { preCheck, postCheck } from '../../server/utils/safety-checks.js';
import { MAX_NEAR_ARGS_SIZE, MAX_RESPONSE_SIZE } from '../../server/utils/constants.js';

// ---------------------------------------------------------------------------
// preCheck — dangerous methods blocklist
// ---------------------------------------------------------------------------

describe('SafetyChecks — dangerous methods', () => {
  test('blocks debug_traceTransaction', () => {
    const result = preCheck('debug_traceTransaction', []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('blocks trace_block', () => {
    const result = preCheck('trace_block', []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('blocks debug_storageRangeAt', () => {
    const result = preCheck('debug_storageRangeAt', []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('blocks debug_traceCall', () => {
    const result = preCheck('debug_traceCall', []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// preCheck — eth_getBlockByNumber / eth_getBlockByHash fullTx guard
// ---------------------------------------------------------------------------

describe('SafetyChecks — full-transaction block guard', () => {
  test('blocks eth_getBlockByNumber with fullTx: true', () => {
    const result = preCheck('eth_getBlockByNumber', ['latest', true]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/fullTx/i);
  });

  test('allows eth_getBlockByNumber with fullTx: false', () => {
    const result = preCheck('eth_getBlockByNumber', ['latest', false]);
    expect(result.allowed).toBe(true);
  });

  test('allows eth_getBlockByNumber without fullTx argument', () => {
    const result = preCheck('eth_getBlockByNumber', ['latest']);
    expect(result.allowed).toBe(true);
  });

  test('blocks eth_getBlockByHash with fullTx: true', () => {
    const hash = '0x' + 'a'.repeat(64);
    const result = preCheck('eth_getBlockByHash', [hash, true]);
    expect(result.allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// preCheck — eth_getLogs block range
// ---------------------------------------------------------------------------

describe('SafetyChecks — eth_getLogs block range', () => {
  test('rejects a block range of 20 (exceeds MAX_BLOCK_RANGE of 10)', () => {
    const filter = {
      address: '0x1234567890123456789012345678901234567890',
      fromBlock: '0x1',   // block 1
      toBlock: '0x15',    // block 21 → range = 20
    };
    const result = preCheck('eth_getLogs', [filter]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/range/i);
  });

  test('allows a block range of 5', () => {
    const filter = {
      address: '0x1234567890123456789012345678901234567890',
      fromBlock: '0x1',  // block 1
      toBlock: '0x6',    // block 6 → range = 5
    };
    const result = preCheck('eth_getLogs', [filter]);
    expect(result.allowed).toBe(true);
  });

  test('allows eth_getLogs when toBlock is "latest"', () => {
    const filter = {
      address: '0x1234567890123456789012345678901234567890',
      fromBlock: '0x1',
      toBlock: 'latest',
    };
    const result = preCheck('eth_getLogs', [filter]);
    expect(result.allowed).toBe(true);
  });

  test('rejects eth_getLogs without address or topics', () => {
    const filter = { fromBlock: '0x1', toBlock: '0x5' };
    const result = preCheck('eth_getLogs', [filter]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/address|topics/i);
  });
});

// ---------------------------------------------------------------------------
// preCheck — compare_balances chain count
// ---------------------------------------------------------------------------

describe('SafetyChecks — compare_balances chain limit', () => {
  test('blocks compare_balances with more than 5 chains', () => {
    const chains = ['eth', 'polygon', 'bnb', 'arbitrum', 'optimism', 'base'];
    const result = preCheck('compare_balances', [chains]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/5/);
  });

  test('allows compare_balances with exactly 5 chains', () => {
    const chains = ['eth', 'polygon', 'bnb', 'arbitrum', 'optimism'];
    const result = preCheck('compare_balances', [chains]);
    expect(result.allowed).toBe(true);
  });

  test('allows compare_balances with fewer than 5 chains', () => {
    const chains = ['eth', 'polygon'];
    const result = preCheck('compare_balances', [chains]);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// preCheck — Near call_function args_base64 size
// ---------------------------------------------------------------------------

describe('SafetyChecks — Near call_function args size', () => {
  test('blocks Near call_function with oversized args_base64', () => {
    // Generate a base64 string whose decoded size exceeds MAX_NEAR_ARGS_SIZE (10 KB)
    const oversizeBytes = MAX_NEAR_ARGS_SIZE + 1024; // 11 KB
    const raw = Buffer.alloc(oversizeBytes, 'x');
    const args_base64 = raw.toString('base64');

    const result = preCheck('query', [
      {
        request_type: 'call_function',
        finality: 'final',
        account_id: 'example.near',
        method_name: 'get_data',
        args_base64,
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/args_base64|size/i);
  });

  test('allows Near call_function with a small args_base64', () => {
    const args_base64 = Buffer.from(JSON.stringify({ key: 'value' })).toString('base64');

    const result = preCheck('query', [
      {
        request_type: 'call_function',
        finality: 'final',
        account_id: 'example.near',
        method_name: 'get_data',
        args_base64,
      },
    ]);

    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// preCheck — Near view_state prefix_base64
// ---------------------------------------------------------------------------

describe('SafetyChecks — Near view_state', () => {
  test('blocks Near view_state without prefix_base64', () => {
    const result = preCheck('query', [
      {
        request_type: 'view_state',
        finality: 'final',
        account_id: 'example.near',
      },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/prefix_base64/i);
  });

  test('blocks Near view_state with empty prefix_base64', () => {
    const result = preCheck('query', [
      {
        request_type: 'view_state',
        finality: 'final',
        account_id: 'example.near',
        prefix_base64: '',
      },
    ]);

    expect(result.allowed).toBe(false);
  });

  test('allows Near view_state with a valid prefix_base64', () => {
    const result = preCheck('query', [
      {
        request_type: 'view_state',
        finality: 'final',
        account_id: 'example.near',
        prefix_base64: Buffer.from('STATE').toString('base64'),
      },
    ]);

    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// postCheck — response size truncation
// ---------------------------------------------------------------------------

describe('SafetyChecks — postCheck response size', () => {
  test('passes through small responses unchanged', () => {
    const data = { result: 'hello', value: 42 };
    const { data: out, truncated } = postCheck(data);
    expect(truncated).toBe(false);
    expect(out).toEqual(data);
  });

  test('truncates responses that exceed 50 KB', () => {
    // Build an object whose JSON serialisation is definitely > MAX_RESPONSE_SIZE
    const bigData = { items: Array.from({ length: 5000 }, (_, i) => ({ id: i, value: 'x'.repeat(20) })) };
    const serialised = JSON.stringify(bigData);
    expect(serialised.length).toBeGreaterThan(MAX_RESPONSE_SIZE);

    const { data: out, truncated } = postCheck(bigData);
    expect(truncated).toBe(true);

    const o = out as { warning: string; partial: string };
    expect(o.warning).toMatch(/truncated/i);
    expect(typeof o.partial).toBe('string');
    expect(o.partial.length).toBeLessThan(serialised.length);
  });

  test('truncation partial is at most 40 KB', () => {
    const bigData = { blob: 'y'.repeat(MAX_RESPONSE_SIZE * 2) };
    const { data: out, truncated } = postCheck(bigData);
    expect(truncated).toBe(true);
    const o = out as { partial: string };
    expect(o.partial.length).toBeLessThanOrEqual(MAX_RESPONSE_SIZE * 0.8 + 1);
  });
});

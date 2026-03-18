import { describe, test, expect } from 'vitest';
import {
  getProtocolDefinition,
  isEvmCompatible,
  getRegisteredProtocols,
} from '../../server/protocols/method-registry.js';

describe('MethodRegistry', () => {
  test('EVM protocol returns json-rpc rpc_type', () => {
    expect(getProtocolDefinition('evm').rpc_type).toBe('json-rpc');
  });

  test('Cosmos protocol returns rest rpc_type', () => {
    expect(getProtocolDefinition('cosmos').rpc_type).toBe('rest');
  });

  test('Solana protocol returns json-rpc rpc_type', () => {
    expect(getProtocolDefinition('solana').rpc_type).toBe('json-rpc');
  });

  test('Sui protocol returns json-rpc rpc_type', () => {
    expect(getProtocolDefinition('sui').rpc_type).toBe('json-rpc');
  });

  test('Near protocol returns json-rpc rpc_type', () => {
    expect(getProtocolDefinition('near').rpc_type).toBe('json-rpc');
  });

  test('Tron protocol returns json-rpc rpc_type', () => {
    expect(getProtocolDefinition('tron').rpc_type).toBe('json-rpc');
  });

  test('isEvmCompatible returns true for EVM chains', () => {
    expect(isEvmCompatible({ protocol: 'evm' })).toBe(true);
  });

  test('isEvmCompatible returns true for Tron (evm_compatible)', () => {
    expect(isEvmCompatible({ protocol: 'tron', evm_compatible: true })).toBe(true);
  });

  test('isEvmCompatible returns false for Cosmos chains', () => {
    expect(isEvmCompatible({ protocol: 'cosmos' })).toBe(false);
  });

  test('unknown protocol throws error', () => {
    expect(() => getProtocolDefinition('unknown-protocol')).toThrow('Unknown protocol');
  });

  test('getRegisteredProtocols returns all 7 protocols', () => {
    const protocols = getRegisteredProtocols();
    expect(protocols).toHaveLength(7);
    expect(protocols).toContain('evm');
    expect(protocols).toContain('cosmos');
    expect(protocols).toContain('solana');
    expect(protocols).toContain('sui');
    expect(protocols).toContain('near');
    expect(protocols).toContain('radix');
    expect(protocols).toContain('tron');
  });
});

/**
 * BlockchainQuery MCP — Cross-Chain Handlers
 *
 * Tools:
 *   resolve_domain    — ENS / Unstoppable Domains resolution
 *   compare_balances  — Native token balances across multiple EVM chains
 *   convert_units     — Denomination conversion (wei/gwei/ETH, lamports/SOL, etc.)
 */

import { domainResolver } from '../services/domain-resolver.js';
import { registry } from '../services/chain-registry.js';
import { dispatch } from '../services/rpc-dispatcher.js';
import { isEvmCompatible } from '../protocols/method-registry.js';
import { preCheck, postCheck } from '../utils/safety-checks.js';
import { UNIT_SYSTEMS } from '../utils/constants.js';
import type { ToolDefinition, ToolHandler } from '../types/index.js';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/**
 * Build a flat lookup map: unit_name → { protocol, divisor }.
 * Gwei is added as a special EVM sub-unit with divisor 1e9 (relative to wei).
 */
interface UnitInfo {
  protocol: string;
  /** How many of this unit equal one display/top unit */
  divisorFromBase: bigint;
  /** The canonical base unit name for this protocol */
  baseUnit: string;
  /** The canonical display unit name for this protocol */
  displayUnit: string;
}

function buildUnitMap(): Map<string, UnitInfo> {
  const map = new Map<string, UnitInfo>();

  for (const [protocol, sys] of Object.entries(UNIT_SYSTEMS)) {
    // Base unit (e.g. "wei", "lamports") → divisorFromBase = 1 (it IS the base)
    map.set(sys.base.toLowerCase(), {
      protocol,
      divisorFromBase: BigInt(1),
      baseUnit: sys.base,
      displayUnit: sys.display,
    });

    // Display unit (e.g. "eth", "sol") → divisorFromBase = sys.divisor
    map.set(sys.display.toLowerCase(), {
      protocol,
      divisorFromBase: sys.divisor,
      baseUnit: sys.base,
      displayUnit: sys.display,
    });
  }

  // Special EVM sub-unit: gwei = 1e9 wei
  map.set('gwei', {
    protocol: 'evm',
    divisorFromBase: BigInt('1000000000'), // 1e9 wei per gwei
    baseUnit: 'wei',
    displayUnit: 'ETH',
  });

  return map;
}

const UNIT_MAP = buildUnitMap();

/**
 * Convert `value` from `from_unit` to `to_unit`.
 * Uses BigInt arithmetic: converts to the smallest integer base unit first,
 * then converts to the target. Fractional remainders are expressed as a
 * decimal string when converting downward in denomination.
 */
function convertUnits(value: string, fromUnit: string, toUnit: string): string {
  const fromKey = fromUnit.toLowerCase();
  const toKey = toUnit.toLowerCase();

  const fromInfo = UNIT_MAP.get(fromKey);
  const toInfo = UNIT_MAP.get(toKey);

  if (!fromInfo) {
    throw new Error(`Unknown unit: ${fromUnit}`);
  }
  if (!toInfo) {
    throw new Error(`Unknown unit: ${toUnit}`);
  }
  if (fromInfo.protocol !== toInfo.protocol) {
    throw new Error(
      `Cannot convert between different protocols: ${fromInfo.protocol} (${fromUnit}) and ${toInfo.protocol} (${toUnit})`,
    );
  }

  // Parse value — may contain a decimal point
  const trimmed = value.trim();
  let valueInBase: bigint;

  if (trimmed.includes('.')) {
    const [intPart = '0', fracPart = ''] = trimmed.split('.');
    // Scale up by fromInfo.divisorFromBase
    const intBig = BigInt(intPart) * fromInfo.divisorFromBase;
    // Handle fractional part: pad/truncate to the number of decimal places
    // implied by divisorFromBase
    const divisorStr = fromInfo.divisorFromBase.toString();
    const scale = divisorStr.length - 1; // e.g. 1e18 → 18 decimal places
    const fracPadded = fracPart.slice(0, scale).padEnd(scale, '0');
    const fracBig = BigInt(fracPadded);
    valueInBase = intBig + fracBig;
  } else {
    valueInBase = BigInt(trimmed) * fromInfo.divisorFromBase;
  }

  // Now convert from base to target unit
  const targetDivisor = toInfo.divisorFromBase;

  if (targetDivisor === BigInt(1)) {
    // Target IS the base unit — result is an integer
    return valueInBase.toString();
  }

  const quotient = valueInBase / targetDivisor;
  const remainder = valueInBase % targetDivisor;

  if (remainder === BigInt(0)) {
    return quotient.toString();
  }

  // Express remainder as decimal fraction
  const divisorStr = targetDivisor.toString();
  const decimalPlaces = divisorStr.length - 1;
  const fracStr = remainder.toString().padStart(decimalPlaces, '0').replace(/0+$/, '');
  return `${quotient}.${fracStr}`;
}

// ---------------------------------------------------------------------------
// Tool: resolve_domain
// ---------------------------------------------------------------------------

const resolveDomainDefinition: ToolDefinition = {
  name: 'resolve_domain',
  description:
    'Resolve ENS (.eth) or Unstoppable Domains (.crypto, .nft, .blockchain, .bitcoin, .coin, .wallet, .888, .dao, .x, .zil) to a blockchain address.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'The domain name to resolve (e.g. vitalik.eth, brad.crypto)',
      },
    },
    required: ['domain'],
  },
};

const resolveDomainHandler: ToolHandler = async (args) => {
  const domain = args['domain'];
  if (typeof domain !== 'string' || domain.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: domain must be a non-empty string.' }],
      isError: true,
    };
  }

  const result = await domainResolver.resolveDomain(domain.trim());

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
};

// ---------------------------------------------------------------------------
// Tool: compare_balances
// ---------------------------------------------------------------------------

const compareBalancesDefinition: ToolDefinition = {
  name: 'compare_balances',
  description:
    "Compare native token balances for an address across multiple EVM-compatible chains. Maximum 5 chains per call. Example: compare_balances('0x...', ['eth', 'arb-one', 'base'])",
  inputSchema: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'The EVM address to query (0x-prefixed, 20 bytes)',
      },
      chains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of chain slugs to query (e.g. ["eth", "arb-one", "base"])',
      },
    },
    required: ['address', 'chains'],
  },
};

const compareBalancesHandler: ToolHandler = async (args) => {
  const address = args['address'];
  const chains = args['chains'];

  if (typeof address !== 'string' || address.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: address must be a non-empty string.' }],
      isError: true,
    };
  }
  if (!Array.isArray(chains) || chains.length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: chains must be a non-empty array of chain slugs.' }],
      isError: true,
    };
  }

  // Safety check: reject > 5 chains
  const safety = preCheck('compare_balances', [chains]);
  if (!safety.allowed) {
    return {
      content: [{ type: 'text', text: `Error: ${safety.reason}` }],
      isError: true,
    };
  }

  // Parallel queries via Promise.allSettled
  const results = await Promise.allSettled(
    (chains as string[]).map(async (slug: string) => {
      const chain = registry.getChain(slug);
      if (!chain) {
        return { chain: slug, error: `Chain '${slug}' not found in registry.` };
      }
      if (!isEvmCompatible(chain)) {
        return { chain: slug, error: `Chain '${slug}' is not EVM-compatible.` };
      }

      const response = await dispatch(chain, 'eth_getBalance', [address, 'latest']);

      if (!response.success || response.data == null) {
        return { chain: slug, error: response.error ?? 'Unknown error fetching balance.' };
      }

      // response.data is a hex string e.g. "0x1a2b3c..."
      const rawHex = response.data as string;
      const rawBig = BigInt(rawHex);
      const evmSystem = UNIT_SYSTEMS['evm']!;
      const divisor = evmSystem.divisor;

      // Format as decimal ETH
      const quotient = rawBig / divisor;
      const remainder = rawBig % divisor;
      let formatted: string;
      if (remainder === BigInt(0)) {
        formatted = quotient.toString();
      } else {
        const divisorStr = divisor.toString();
        const decimalPlaces = divisorStr.length - 1;
        const fracStr = remainder.toString().padStart(decimalPlaces, '0').replace(/0+$/, '');
        formatted = `${quotient}.${fracStr}`;
      }

      // Check response size
      const checked = postCheck(response.data);
      void checked; // balance is a simple hex string — no truncation concern

      return {
        chain: slug,
        balance_raw: rawHex,
        balance_formatted: formatted,
        unit: evmSystem.display,
      };
    }),
  );

  const output = results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const slug = (chains as string[])[i] ?? 'unknown';
    return { chain: slug, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    isError: false,
  };
};

// ---------------------------------------------------------------------------
// Tool: convert_units
// ---------------------------------------------------------------------------

const convertUnitsDefinition: ToolDefinition = {
  name: 'convert_units',
  description:
    'Convert between blockchain denomination units. Supported pairs: wei/gwei/ETH, lamports/SOL, MIST/SUI, yoctoNEAR/NEAR, SUN/TRX, upokt/POKT',
  inputSchema: {
    type: 'object',
    properties: {
      value: {
        type: 'string',
        description: 'The numeric value to convert (as a string to preserve precision)',
      },
      from_unit: {
        type: 'string',
        description: 'Source unit (e.g. wei, gwei, ETH, lamports, SOL, MIST, SUI, yoctoNEAR, NEAR, SUN, TRX, upokt, POKT)',
      },
      to_unit: {
        type: 'string',
        description: 'Target unit (same set as from_unit)',
      },
    },
    required: ['value', 'from_unit', 'to_unit'],
  },
};

const convertUnitsHandler: ToolHandler = async (args) => {
  const value = args['value'];
  const fromUnit = args['from_unit'];
  const toUnit = args['to_unit'];

  if (typeof value !== 'string' || value.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: value must be a non-empty string.' }],
      isError: true,
    };
  }
  if (typeof fromUnit !== 'string' || fromUnit.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: from_unit must be a non-empty string.' }],
      isError: true,
    };
  }
  if (typeof toUnit !== 'string' || toUnit.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: to_unit must be a non-empty string.' }],
      isError: true,
    };
  }

  try {
    const result = convertUnits(value.trim(), fromUnit.trim(), toUnit.trim());
    const output = {
      input: { value: value.trim(), unit: fromUnit.trim() },
      output: { value: result, unit: toUnit.trim() },
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      isError: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function registerTools(): RegisteredTool[] {
  return [
    { definition: resolveDomainDefinition, handler: resolveDomainHandler },
    { definition: compareBalancesDefinition, handler: compareBalancesHandler },
    { definition: convertUnitsDefinition, handler: convertUnitsHandler },
  ];
}

/**
 * BlockchainQuery MCP — Shared Type Definitions
 */

/** Chain information from the supported-chains registry */
export interface ChainInfo {
  name: string;
  slug: string;
  protocol: string;
  url: string;
  network: 'mainnet' | 'testnet';
  evm_compatible?: boolean;
  status?: 'active' | 'inactive' | 'degraded';
  notes?: string;
}

/** Top-level chain registry structure */
export interface ChainRegistry {
  version: string;
  updated_at: string;
  gateway_base_url: string;
  chains: ChainInfo[];
}

/** Protocol definition from the method registry */
export interface ProtocolDefinition {
  rpc_type: 'json-rpc' | 'rest' | 'post-rest';
  methods: MethodDefinition[];
  address_format?: RegExp | string;
  units?: {
    base: string;
    display: string;
    divisor: bigint | number;
  };
}

/** Individual RPC method definition */
export interface MethodDefinition {
  name: string;
  params: MethodParam[];
  description: string;
}

/** Method parameter definition */
export interface MethodParam {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

/** Generic RPC response wrapper */
export interface RpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  chain?: string;
  method?: string;
  truncated?: boolean;
}

/** Safety check result */
export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  modified_params?: Record<string, unknown>;
}

/** Standard tool response format */
export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

/** MCP tool definition — name, description, and JSON Schema for inputs */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** MCP tool handler — receives validated args and returns a ToolResponse */
export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>;

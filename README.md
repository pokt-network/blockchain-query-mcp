# BlockchainQuery

> Free live blockchain data access for Claude — powered by [Pocket Network](https://pocket.network)

![62 Chains](https://img.shields.io/badge/chains-62-025af2?style=flat-square&labelColor=f6f6f6)
![6 Protocols](https://img.shields.io/badge/protocols-6-025af2?style=flat-square&labelColor=f6f6f6)
![MIT License](https://img.shields.io/badge/license-MIT-025af2?style=flat-square&labelColor=f6f6f6)

## What is BlockchainQuery?

BlockchainQuery is a free Claude Desktop Extension provided as a public good by
the Pocket Network Foundation. It gives Claude real-time access to blockchain
data across 60+ networks — no API keys, no authentication, no cost.

All queries are served through Pocket Network's decentralized RPC gateway at
https://api.pocket.network, backed by thousands of independently operated nodes.

## Installation

1. Download `BlockchainQuery.mcpb` from [Releases](https://github.com/pokt-network/blockchain-query-mcp/releases)
2. Double-click to open with Claude Desktop
3. Click "Install"

That's it. No terminal, no configuration, no dependencies.

## Updating

1. Uninstall the current version from Claude Desktop
2. Download the latest `BlockchainQuery.mcpb` from [Releases](https://github.com/pokt-network/blockchain-query-mcp/releases)
3. Double-click to install the new version

## Supported Chains

The chain list is fetched at startup from the
[Pocket Network public-rpc registry](https://github.com/pokt-network/public-rpc/blob/main/supported-chains.json).
Use `list_chains` to see the current set, or `get_chain_info` for details on a
specific chain.

Currently 60+ chains across EVM, Solana, Cosmos, Sui, Near, and Tron protocols.

## Available Tools (37)

### Discovery (2)
| Tool | Description |
|------|-------------|
| `list_chains` | List supported blockchain networks with optional protocol or network filter |
| `get_chain_info` | Get RPC URL, protocol type, supported methods, and status for a specific chain |

### EVM (9)
| Tool | Description |
|------|-------------|
| `evm_call` | Execute a JSON-RPC call on any EVM-compatible blockchain |
| `evm_get_balance` | Get native token balance for an address on any EVM chain |
| `evm_get_block` | Get block details by number or hash from any EVM chain |
| `evm_get_transaction` | Get transaction details by hash from any EVM chain |
| `evm_get_receipt` | Get transaction receipt including logs, status, and gas used |
| `evm_get_logs` | Search event logs with block range safety limits |
| `evm_estimate_gas` | Estimate gas cost for a transaction on any EVM chain |
| `evm_get_token_info` | Get ERC-20 token balance, name, symbol, decimals, and total supply |
| `evm_call_contract` | Execute a read-only smart contract function call |

### Solana (5)
| Tool | Description |
|------|-------------|
| `solana_get_balance` | Get SOL or SPL token balance for a Solana address |
| `solana_get_account` | Get Solana account information |
| `solana_get_block` | Get Solana block details by slot number |
| `solana_get_transaction` | Get Solana transaction details by signature |
| `solana_get_signatures` | Get recent transaction signatures for a Solana address |

### Cosmos (6)
| Tool | Description |
|------|-------------|
| `cosmos_get_balance` | Get native or all token balances on any Cosmos SDK chain |
| `cosmos_get_staking` | Get staking delegations and rewards |
| `cosmos_get_validators` | Get validator list or details |
| `cosmos_get_transaction` | Get transaction details by hash |
| `cosmos_get_governance` | Get governance proposals and votes |
| `cosmos_get_block` | Get block by height or latest |

### Sui (4)
| Tool | Description |
|------|-------------|
| `sui_get_balance` | Get SUI or token balance for a Sui address |
| `sui_get_object` | Get Sui object details by ID |
| `sui_get_transaction` | Get Sui transaction details by digest |
| `sui_get_coins` | Get coin details with pagination |

### Near (3)
| Tool | Description |
|------|-------------|
| `near_query` | Query account info, view function calls, access keys, or contract state |
| `near_get_block` | Get Near block by height, hash, or latest |
| `near_get_transaction` | Get Near transaction status and receipts |

### Radix (5)
| Tool | Description |
|------|-------------|
| `radix_get_network_status` | Get network status including state version, epoch, round, and timestamp |
| `radix_get_network_config` | Get network configuration including version info and well-known addresses |
| `radix_get_balance` | Get all fungible token balances for a Radix account address |
| `radix_get_transaction_status` | Get the status of a Radix transaction by its intent hash |
| `radix_get_consensus_manager` | Get consensus manager state including validator set and epoch info |

### Cross-Chain (3)
| Tool | Description |
|------|-------------|
| `resolve_domain` | Resolve ENS or Unstoppable Domains to a blockchain address |
| `compare_balances` | Compare native token balances across multiple chains (max 5) |
| `convert_units` | Convert between blockchain denomination units |

## Example Queries

> "What's the ETH balance of vitalik.eth?"
> "Show me the latest block on Solana"
> "What are the staking rewards for cosmos1... on Osmosis?"
> "Compare my balance across Ethereum, Arbitrum, and Base"
> "Look up transaction 0xabc... on Polygon"

## Configuration (Optional)

BlockchainQuery works out of the box with zero configuration. Advanced users
can set environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CHAIN_REGISTRY_URL` | [public-rpc/supported-chains.json](https://raw.githubusercontent.com/pokt-network/public-rpc/main/supported-chains.json) | Override the default chain registry URL |
| `ENABLE_LIVENESS_PROBES` | `true` | Set `false` to skip background chain health checks |

## About Pocket Network

Pocket Network is decentralized infrastructure for accessing open data.
Thousands of independent nodes serve billions of relays across 60+ blockchains.
As a non-profit public good, Pocket provides free RPC access to anyone.

Learn more at [pocket.network](https://pocket.network)

## License

MIT — Pocket Network Foundation

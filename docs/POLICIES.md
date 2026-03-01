# Policy Configuration

Policies define what your agent can and cannot do. They're enforced both off-chain (for speed) and on-chain (for trustlessness).

## Policy Types

### Spending Limits

Control how much your agent can spend:

```json
{
  "spending": {
    "daily_limit_usd": 100,
    "per_tx_limit_usd": 25,
    "weekly_limit_usd": 500
  }
}
```

### Token Allowlist

Restrict which tokens the agent can interact with:

```json
{
  "tokens": {
    "mode": "allowlist",
    "allowed": ["SOL", "USDC", "BONK", "JUP"],
    "blocked": []
  }
}
```

### Protocol Permissions

Control which DeFi protocols are accessible:

```json
{
  "protocols": {
    "jupiter": { "enabled": true, "max_slippage_bps": 100 },
    "raydium": { "enabled": true, "pools": ["SOL-USDC"] },
    "marinade": { "enabled": true },
    "tensor": { "enabled": false }
  }
}
```

### Action Types

Enable/disable specific action categories:

```json
{
  "actions": {
    "swap": true,
    "stake": true,
    "lp_provide": false,
    "nft_trade": false,
    "transfer_out": false
  }
}
```

## Updating Policies

### Via Dashboard

1. Navigate to Settings → Policies
2. Modify constraints
3. Sign the update transaction

### Via CLI

```bash
agentvault policy update --file policy.json
```

### Via Agent

```
"Set my daily spending limit to 50 USDC"
"Block all NFT trading"
"Only allow swaps on Jupiter"
```

## Policy Hierarchy

When policies conflict, the most restrictive wins:

1. **Global limits** (protocol-level caps)
2. **User policy** (your configured constraints)
3. **Strategy defaults** (if using marketplace strategies)

## Emergency Controls

### Pause Agent

Immediately stop all agent activity:

```
"Pause my agent"
```

Or via dashboard: Settings → Emergency → Pause

### Revoke Permissions

Remove all agent permissions instantly:

```bash
agentvault emergency revoke
```

This requires a new vault setup to re-enable.

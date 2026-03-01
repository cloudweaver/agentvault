import { Tool, ToolParameter } from '../types/index.js';

/**
 * MCP-compatible tool definitions for the agent
 */
export function getToolDefinitions(): Tool[] {
  return [
    {
      name: 'swap_tokens',
      description: 'Execute a token swap via Jupiter aggregator with optimal routing',
      parameters: [
        {
          name: 'inputMint',
          type: 'string',
          description: 'SPL token mint address to swap from',
          required: true,
        },
        {
          name: 'outputMint',
          type: 'string',
          description: 'SPL token mint address to swap to',
          required: true,
        },
        {
          name: 'amount',
          type: 'number',
          description: 'Amount to swap in lamports/smallest unit',
          required: true,
        },
        {
          name: 'slippageBps',
          type: 'number',
          description: 'Maximum slippage in basis points (100 = 1%)',
          required: false,
        },
      ],
      execute: async (params) => {
        // Implemented in runtime
        return { success: true, data: { txSignature: 'pending' } };
      },
    },
    {
      name: 'check_price',
      description: 'Get real-time price for any SPL token via Pyth or Jupiter',
      parameters: [
        {
          name: 'mint',
          type: 'string',
          description: 'SPL token mint address',
          required: true,
        },
      ],
      execute: async (params) => {
        return { success: true, data: { price: 0, source: 'jupiter' } };
      },
    },
    {
      name: 'get_portfolio',
      description: 'Retrieve current vault balances, positions, and unrealized PnL',
      parameters: [],
      execute: async () => {
        return { success: true, data: { positions: [], totalValue: 0 } };
      },
    },
    {
      name: 'stake_sol',
      description: 'Stake SOL to a liquid staking protocol (Marinade, Jito, etc.)',
      parameters: [
        {
          name: 'amount',
          type: 'number',
          description: 'Amount of SOL to stake in lamports',
          required: true,
        },
        {
          name: 'protocol',
          type: 'string',
          description: 'Staking protocol: marinade, jito, or blaze',
          required: false,
        },
      ],
      execute: async (params) => {
        return { success: true, data: { txSignature: 'pending' } };
      },
    },
    {
      name: 'unstake_sol',
      description: 'Unstake SOL from a liquid staking protocol',
      parameters: [
        {
          name: 'amount',
          type: 'number',
          description: 'Amount to unstake in lamports',
          required: true,
        },
        {
          name: 'protocol',
          type: 'string',
          description: 'Staking protocol to unstake from',
          required: true,
        },
        {
          name: 'instant',
          type: 'boolean',
          description: 'Use instant unstake (may have fee)',
          required: false,
        },
      ],
      execute: async (params) => {
        return { success: true, data: { txSignature: 'pending' } };
      },
    },
    {
      name: 'set_trigger',
      description: 'Create a price/time/condition trigger for autonomous monitoring',
      parameters: [
        {
          name: 'type',
          type: 'string',
          description: 'Trigger type: price, time, portfolio, or event',
          required: true,
        },
        {
          name: 'condition',
          type: 'object',
          description: 'Condition object with field, operator, and value',
          required: true,
        },
        {
          name: 'action',
          type: 'object',
          description: 'Action to execute when trigger fires',
          required: true,
        },
      ],
      execute: async (params) => {
        return { success: true, data: { triggerId: 'pending' } };
      },
    },
    {
      name: 'get_yield_rates',
      description: 'Fetch current APY across lending and LP protocols',
      parameters: [
        {
          name: 'protocols',
          type: 'string',
          description: 'Comma-separated list of protocols to check',
          required: false,
        },
      ],
      execute: async (params) => {
        return {
          success: true,
          data: {
            rates: [
              { protocol: 'marinade', type: 'staking', apy: 7.2 },
              { protocol: 'marginfi', type: 'lending', asset: 'USDC', apy: 8.5 },
            ],
          },
        };
      },
    },
    {
      name: 'explain_action',
      description: 'Generate human-readable explanation of a proposed transaction',
      parameters: [
        {
          name: 'action',
          type: 'object',
          description: 'The action/operation to explain',
          required: true,
        },
      ],
      execute: async (params) => {
        return { success: true, data: { explanation: 'Pending...' } };
      },
    },
  ];
}

/**
 * Get tool definitions in Anthropic function calling format
 */
export function getAnthropicTools() {
  return getToolDefinitions().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        tool.parameters.map((p) => [
          p.name,
          {
            type: p.type,
            description: p.description,
          },
        ])
      ),
      required: tool.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}

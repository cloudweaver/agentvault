import Anthropic from '@anthropic-ai/sdk';
import {
  UserIntent,
  ActionPlan,
  AgentContext,
  Operation,
  LLMProvider,
} from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { getToolDefinitions } from '../tools/definitions.js';

const logger = createLogger('llm-claude');

const SYSTEM_PROMPT = `You are an AI agent managing a Solana DeFi wallet for a user. Your role is to:

1. Understand user intents expressed in natural language
2. Generate safe, efficient action plans within policy constraints
3. Explain your reasoning clearly

IMPORTANT CONSTRAINTS:
- You CANNOT modify your own policies or constraints
- You CANNOT withdraw funds to external addresses
- You MUST respect spending limits and asset allowlists
- You MUST provide reasoning for every action

When generating an action plan, output a JSON object with this structure:
{
  "operations": [
    {
      "type": "swap" | "stake" | "unstake" | "lend" | "withdraw_lending" | "set_trigger",
      "params": { ... operation-specific parameters ... },
      "estimatedGas": number,
      "requiresApproval": boolean
    }
  ],
  "reasoning": "Explanation of why this plan achieves the user's goal safely"
}

Available operations:
- swap: Exchange tokens via Jupiter (params: inputMint, outputMint, amount, slippageBps)
- stake: Stake SOL to liquid staking (params: amount, protocol)
- unstake: Unstake from liquid staking (params: amount, protocol)
- lend: Supply to lending protocol (params: amount, protocol, mint)
- withdraw_lending: Withdraw from lending (params: amount, protocol, mint)
- set_trigger: Create a monitoring trigger (params: type, condition, action)`;

export class ClaudeLLMProvider implements LLMProvider {
  name = 'claude';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateActionPlan(intent: UserIntent, context: AgentContext): Promise<ActionPlan> {
    const startTime = Date.now();

    const contextPrompt = this.buildContextPrompt(context);
    
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${contextPrompt}\n\nUser request: "${intent.text}"\n\nGenerate an action plan as JSON.`,
        },
      ],
    });

    const latencyMs = Date.now() - startTime;
    logger.info({ latencyMs, model: 'claude-sonnet-4-20250514' }, 'LLM response received');

    // Parse response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      id: crypto.randomUUID(),
      intentId: intent.id,
      operations: parsed.operations.map((op: any) => ({
        type: op.type,
        params: op.params,
        estimatedGas: op.estimatedGas || 5000,
        requiresApproval: op.requiresApproval || false,
      })),
      reasoning: parsed.reasoning,
      estimatedGas: parsed.operations.reduce((sum: number, op: any) => sum + (op.estimatedGas || 5000), 0),
      createdAt: new Date(),
    };
  }

  async explainAction(operation: Operation): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Explain this DeFi operation in simple terms for a user:\n\n${JSON.stringify(operation, null, 2)}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    return content.text;
  }

  private buildContextPrompt(context: AgentContext): string {
    const { vault, portfolio, policy } = context;

    return `CURRENT STATE:
Vault Balance: ${Number(vault.balance) / 1e9} SOL
Portfolio Value: $${portfolio.totalValueUsd.toFixed(2)} (${portfolio.totalValueSol.toFixed(2)} SOL)
Positions: ${portfolio.positions.length} tokens

POLICY CONSTRAINTS:
- Max per transaction: ${policy.spending.perTransaction.sol} SOL
- Max per day: ${policy.spending.daily.sol} SOL
- Max slippage: ${policy.limits.maxSlippageBps / 100}%
- Max position size: ${policy.limits.maxPositionPercent}%
- Min stablecoin reserve: ${policy.limits.minStablecoinPercent}%
- Auto-execute price triggers: ${policy.autoExecute.priceTriggers ? 'Yes' : 'No'}
${policy.allowlists.assets.length > 0 ? `- Allowed assets: ${policy.allowlists.assets.join(', ')}` : '- All assets allowed'}`;
  }
}

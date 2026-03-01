'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  actionPlan?: ActionPlan;
}

interface ActionPlan {
  operations: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  reasoning: string;
}

export function ChatInterface() {
  const { publicKey } = useWallet();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: `Hello! I'm your AgentVault assistant. I can help you manage your DeFi portfolio autonomously within the guardrails you set.\n\nTry saying something like:\n• "Swap 1 SOL to USDC"\n• "What's my portfolio worth?"\n• "Set a trigger to buy SOL if it drops below $100"`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate agent response
    setTimeout(() => {
      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: getSimulatedResponse(input.trim()),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="card h-[calc(100vh-200px)] flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-vault-600 text-white'
                  : 'bg-dark-700 text-dark-100'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              <p className="text-xs opacity-50 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-dark-700 rounded-lg px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-vault-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-vault-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-vault-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell me what you want to do..."
          className="input flex-1"
          disabled={isLoading}
        />
        <button type="submit" className="btn-primary" disabled={isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

function getSimulatedResponse(input: string): string {
  const lower = input.toLowerCase();
  
  if (lower.includes('swap')) {
    return `I understand you want to execute a swap. Here's my plan:

**Action Plan:**
• Type: Token Swap via Jupiter
• Estimated slippage: <1%
• Policy check: ✅ Within daily limit

This swap is within your policy constraints. Would you like me to execute it?`;
  }
  
  if (lower.includes('portfolio') || lower.includes('worth')) {
    return `**Your Portfolio:**

• SOL: 10.5 (~$1,050)
• USDC: 500.00 ($500)
• JitoSOL: 5.2 (~$520)

**Total Value:** $2,070 USD

Your portfolio is well-diversified with 24% in stablecoins, which meets your minimum reserve policy.`;
  }
  
  if (lower.includes('trigger') || lower.includes('alert')) {
    return `I can set up that trigger for you:

**Trigger Configuration:**
• Type: Price Alert
• Condition: SOL < $100
• Action: Buy 5 SOL

This trigger will monitor SOL price and execute automatically when conditions are met (auto-execute is enabled for price triggers in your policy).

Should I activate this trigger?`;
  }
  
  return `I understand your request. Let me analyze the best approach within your policy constraints and get back to you with an action plan.

Is there anything specific you'd like me to prioritize?`;
}

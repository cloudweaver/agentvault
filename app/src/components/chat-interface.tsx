'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useVault } from '@/contexts/VaultContext';
import type { ActionPlan } from '@/lib/api';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  actionPlan?: ActionPlan;
  status?: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

export function ChatInterface() {
  const { publicKey } = useWallet();
  const { 
    vault, 
    connectionStatus, 
    pendingPlans, 
    submitIntent, 
    approvePlan, 
    rejectPlan,
    portfolio,
  } = useVault();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'agent',
      content: `Hello! I'm your AgentVault assistant. I can help you manage your DeFi portfolio autonomously within the guardrails you set.\n\nTry saying something like:\n• "Swap 1 SOL to USDC"\n• "What's my portfolio worth?"\n• "Stake 5 SOL with Marinade"`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle incoming action plans from WebSocket
  useEffect(() => {
    if (pendingPlans.length > 0) {
      const latestPlan = pendingPlans[pendingPlans.length - 1];
      
      // Check if we already have this plan as a message
      const exists = messages.some(m => m.actionPlan?.id === latestPlan.plan.id);
      if (!exists) {
        const agentMessage: Message = {
          id: `plan-${latestPlan.plan.id}`,
          role: 'agent',
          content: formatActionPlan(latestPlan.plan),
          timestamp: latestPlan.receivedAt,
          actionPlan: latestPlan.plan,
          status: 'pending',
        };
        setMessages((prev) => [...prev, agentMessage]);
        setIsLoading(false);
      }
    }
  }, [pendingPlans, messages]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !vault) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const intentText = input.trim();
    setInput('');
    setIsLoading(true);

    // Submit intent via WebSocket
    submitIntent(intentText);

    // Timeout for response
    setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: 'I\'m processing your request. This may take a moment...',
          timestamp: new Date(),
        }]);
      }
    }, 10000);
  }, [input, isLoading, vault, submitIntent]);

  const handleApprove = useCallback((planId: string) => {
    approvePlan(planId);
    setMessages((prev) =>
      prev.map((m) =>
        m.actionPlan?.id === planId ? { ...m, status: 'approved' as const } : m
      )
    );
  }, [approvePlan]);

  const handleReject = useCallback((planId: string) => {
    rejectPlan(planId);
    setMessages((prev) =>
      prev.map((m) =>
        m.actionPlan?.id === planId ? { ...m, status: 'rejected' as const } : m
      )
    );
  }, [rejectPlan]);

  // Connection status indicator
  const statusColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500',
    disconnected: 'bg-red-500',
    error: 'bg-red-500',
  }[connectionStatus];

  return (
    <div className="card h-[calc(100vh-200px)] flex flex-col">
      {/* Header with status */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-dark-700">
        <h2 className="text-lg font-semibold text-dark-100">Chat with Agent</h2>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-dark-400 capitalize">{connectionStatus}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-vault-600 text-white'
                  : 'bg-dark-700 text-dark-100'
              }`}
            >
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              
              {/* Action buttons for pending plans */}
              {message.actionPlan && message.status === 'pending' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-dark-600">
                  <button
                    onClick={() => handleApprove(message.actionPlan!.id)}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(message.actionPlan!.id)}
                    className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              )}

              {/* Status badge */}
              {message.status && message.status !== 'pending' && (
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    message.status === 'approved' || message.status === 'executed' 
                      ? 'bg-green-600/20 text-green-400'
                      : message.status === 'rejected' || message.status === 'failed'
                      ? 'bg-red-600/20 text-red-400'
                      : 'bg-yellow-600/20 text-yellow-400'
                  }`}>
                    {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                  </span>
                </div>
              )}

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
          placeholder={vault ? "Tell me what you want to do..." : "Connect wallet and select vault first"}
          className="input flex-1"
          disabled={isLoading || !vault || connectionStatus !== 'connected'}
        />
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={isLoading || !input.trim() || !vault || connectionStatus !== 'connected'}
        >
          Send
        </button>
      </form>
    </div>
  );
}

function formatActionPlan(plan: ActionPlan): string {
  const operations = plan.operations
    .map((op, i) => `${i + 1}. **${op.type}**: ${JSON.stringify(op.params)}`)
    .join('\n');

  return `**Action Plan Generated**

${plan.reasoning}

**Operations:**
${operations}

**Estimated Gas:** ${plan.estimatedGas} lamports

${plan.operations.some(op => op.requiresApproval) ? '⚠️ This action requires your approval.' : '✅ This action can be auto-executed.'}`;
}

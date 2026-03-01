'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ChatInterface } from '@/components/chat-interface';
import { PortfolioDashboard } from '@/components/portfolio-dashboard';
import { ActivityFeed } from '@/components/activity-feed';

export default function Home() {
  const { connected } = useWallet();
  const [activeTab, setActiveTab] = useState<'chat' | 'portfolio' | 'activity'>('chat');

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-dark-700 bg-dark-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-vault-600 rounded-lg flex items-center justify-center">
              <span className="text-xl">🔐</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AgentVault</h1>
              <p className="text-xs text-dark-400">AI-Powered Wallet</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {connected && (
              <nav className="flex gap-1 bg-dark-800 rounded-lg p-1">
                {(['chat', 'portfolio', 'activity'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? 'bg-vault-600 text-white'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            )}
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {!connected ? (
          <LandingContent />
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'chat' && <ChatInterface />}
            {activeTab === 'portfolio' && <PortfolioDashboard />}
            {activeTab === 'activity' && <ActivityFeed />}
          </div>
        )}
      </div>
    </main>
  );
}

function LandingContent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="mb-8">
        <div className="w-24 h-24 bg-vault-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">🔐</span>
        </div>
        <h2 className="text-4xl font-bold text-white mb-4">
          Your Personal AI Agent Wallet
        </h2>
        <p className="text-xl text-dark-300 max-w-2xl mx-auto">
          Tell your wallet what you want. Set your rules. Let your AI agent handle the rest
          — monitoring markets, executing trades, and managing yield positions autonomously.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
        {[
          {
            icon: '💬',
            title: 'Natural Language',
            description: 'Talk to your wallet like you talk to a financial advisor',
          },
          {
            icon: '🛡️',
            title: 'Policy Guardrails',
            description: 'Set spending limits, asset allowlists, and contract permissions',
          },
          {
            icon: '📊',
            title: 'Full Transparency',
            description: 'Every action logged with reasoning traces and on-chain receipts',
          },
        ].map((feature) => (
          <div key={feature.title} className="card text-left">
            <span className="text-3xl mb-4 block">{feature.icon}</span>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-dark-400 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <WalletMultiButton />
        <a
          href="https://docs.agentvault.io"
          className="btn-secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read Docs
        </a>
      </div>
    </div>
  );
}

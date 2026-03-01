'use client';

import { useState } from 'react';

interface Activity {
  id: string;
  type: 'swap' | 'stake' | 'trigger' | 'policy';
  title: string;
  description: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: Date;
  txSignature?: string;
  reasoning?: string;
}

const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'swap',
    title: 'Swapped SOL → USDC',
    description: '2.5 SOL → 250 USDC via Jupiter',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    txSignature: '4Xz9j...8kP2',
    reasoning: 'User requested swap to increase stablecoin position',
  },
  {
    id: '2',
    type: 'stake',
    title: 'Staked SOL to Jito',
    description: '5 SOL → 4.95 JitoSOL',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    txSignature: '7Yp3m...2nQ9',
    reasoning: 'Yield optimizer strategy detected higher APY on Jito',
  },
  {
    id: '3',
    type: 'trigger',
    title: 'Price trigger activated',
    description: 'SOL dropped below $95, buying 3 SOL',
    status: 'pending',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    reasoning: 'DCA strategy trigger fired on price condition',
  },
  {
    id: '4',
    type: 'policy',
    title: 'Policy updated',
    description: 'Daily limit increased to 20 SOL',
    status: 'success',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export function ActivityFeed() {
  const [activities] = useState(mockActivities);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'swap': return '🔄';
      case 'stake': return '🥩';
      case 'trigger': return '⚡';
      case 'policy': return '📋';
    }
  };

  const getStatusBadge = (status: Activity['status']) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 bg-vault-600/20 text-vault-400 text-xs rounded-full">Success</span>;
      case 'pending':
        return <span className="px-2 py-0.5 bg-yellow-600/20 text-yellow-400 text-xs rounded-full">Pending</span>;
      case 'failed':
        return <span className="px-2 py-0.5 bg-red-600/20 text-red-400 text-xs rounded-full">Failed</span>;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Activity Feed</h3>
        <button className="text-sm text-vault-400 hover:text-vault-300">
          Export CSV
        </button>
      </div>

      <div className="space-y-3">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="bg-dark-900 rounded-lg p-4 hover:bg-dark-800 transition-colors cursor-pointer"
            onClick={() => setExpandedId(expandedId === activity.id ? null : activity.id)}
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl">{getIcon(activity.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-white">{activity.title}</h4>
                  {getStatusBadge(activity.status)}
                </div>
                <p className="text-sm text-dark-400">{activity.description}</p>
                
                {expandedId === activity.id && (
                  <div className="mt-4 pt-4 border-t border-dark-700 space-y-3">
                    {activity.reasoning && (
                      <div>
                        <p className="text-xs text-dark-500 uppercase mb-1">Agent Reasoning</p>
                        <p className="text-sm text-dark-300">{activity.reasoning}</p>
                      </div>
                    )}
                    {activity.txSignature && (
                      <div>
                        <p className="text-xs text-dark-500 uppercase mb-1">Transaction</p>
                        <a
                          href={`https://solscan.io/tx/${activity.txSignature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-vault-400 hover:text-vault-300 font-mono"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activity.txSignature} ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right text-sm text-dark-500 whitespace-nowrap">
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

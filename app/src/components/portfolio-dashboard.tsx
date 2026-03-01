'use client';

import { useState } from 'react';

interface Position {
  symbol: string;
  name: string;
  amount: number;
  valueUsd: number;
  change24h: number;
  icon: string;
}

const mockPositions: Position[] = [
  { symbol: 'SOL', name: 'Solana', amount: 10.5, valueUsd: 1050, change24h: 2.5, icon: '◎' },
  { symbol: 'USDC', name: 'USD Coin', amount: 500, valueUsd: 500, change24h: 0, icon: '$' },
  { symbol: 'JitoSOL', name: 'Jito Staked SOL', amount: 5.2, valueUsd: 520, change24h: 2.7, icon: '🔥' },
];

export function PortfolioDashboard() {
  const [positions] = useState(mockPositions);
  const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-dark-400 text-sm mb-1">Total Value</p>
          <p className="text-2xl font-bold text-white">${totalValue.toLocaleString()}</p>
          <p className="text-vault-400 text-sm mt-1">+$52.50 (2.6%)</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm mb-1">24h Change</p>
          <p className="text-2xl font-bold text-vault-400">+2.6%</p>
          <p className="text-dark-400 text-sm mt-1">$52.50 USD</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm mb-1">Active Strategies</p>
          <p className="text-2xl font-bold text-white">2</p>
          <p className="text-dark-400 text-sm mt-1">DCA, Yield Optimizer</p>
        </div>
        <div className="card">
          <p className="text-dark-400 text-sm mb-1">Daily Limit Used</p>
          <p className="text-2xl font-bold text-white">15%</p>
          <p className="text-dark-400 text-sm mt-1">3 / 20 SOL</p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Positions</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-dark-400 text-sm border-b border-dark-700">
                <th className="text-left py-3 px-2">Asset</th>
                <th className="text-right py-3 px-2">Balance</th>
                <th className="text-right py-3 px-2">Value</th>
                <th className="text-right py-3 px-2">24h</th>
                <th className="text-right py-3 px-2">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.symbol} className="border-b border-dark-700/50 hover:bg-dark-700/30">
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{position.icon}</span>
                      <div>
                        <p className="font-medium text-white">{position.symbol}</p>
                        <p className="text-sm text-dark-400">{position.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-4 px-2 font-mono text-white">
                    {position.amount.toLocaleString()}
                  </td>
                  <td className="text-right py-4 px-2 font-mono text-white">
                    ${position.valueUsd.toLocaleString()}
                  </td>
                  <td className={`text-right py-4 px-2 font-mono ${
                    position.change24h > 0 ? 'text-vault-400' : position.change24h < 0 ? 'text-red-400' : 'text-dark-400'
                  }`}>
                    {position.change24h > 0 ? '+' : ''}{position.change24h}%
                  </td>
                  <td className="text-right py-4 px-2">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-vault-500 rounded-full"
                          style={{ width: `${(position.valueUsd / totalValue) * 100}%` }}
                        />
                      </div>
                      <span className="text-dark-400 text-sm font-mono w-12 text-right">
                        {((position.valueUsd / totalValue) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Policy Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">Policy Summary</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-dark-900 rounded-lg p-4">
            <p className="text-dark-400 text-sm mb-2">Spending Limits</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-dark-300">Per Transaction</span>
                <span className="text-white font-mono">5 SOL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-300">Daily</span>
                <span className="text-white font-mono">20 SOL</span>
              </div>
            </div>
          </div>
          <div className="bg-dark-900 rounded-lg p-4">
            <p className="text-dark-400 text-sm mb-2">Constraints</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-dark-300">Max Slippage</span>
                <span className="text-white font-mono">1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-300">Min Stablecoins</span>
                <span className="text-white font-mono">20%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'AgentVault | AI-Powered Solana Wallet',
  description: 'Your personal AI agent wallet on Solana. Autonomous DeFi management within user-defined guardrails.',
  keywords: ['Solana', 'DeFi', 'AI', 'Wallet', 'Agent', 'Crypto'],
  authors: [{ name: 'CloudWeaver' }],
  openGraph: {
    title: 'AgentVault',
    description: 'Your personal AI agent wallet on Solana',
    url: 'https://agentvault.io',
    siteName: 'AgentVault',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentVault',
    description: 'Your personal AI agent wallet on Solana',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

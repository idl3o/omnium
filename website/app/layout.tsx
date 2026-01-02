import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: 'OMNIUM | Dimensional Money',
  description: 'What if money could remember what it\'s for? A meta-currency framework where value carries meaning.',
  keywords: ['omnium', 'dimensional money', 'meta-currency', 'web3', 'decentralized finance'],
  openGraph: {
    title: 'OMNIUM | Dimensional Money',
    description: 'What if money could remember what it\'s for?',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}

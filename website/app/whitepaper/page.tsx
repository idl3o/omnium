import { Metadata } from 'next'
import { WhitepaperContent } from '@/components/WhitepaperContent'

export const metadata: Metadata = {
  title: 'Whitepaper | OMNIUM',
  description: 'The complete technical whitepaper for OMNIUM - a meta-currency framework implementing dimensional money.',
}

export default function WhitepaperPage() {
  return <WhitepaperContent />
}

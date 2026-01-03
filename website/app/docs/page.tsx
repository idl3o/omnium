import { Metadata } from 'next'
import { DocsContent } from '@/components/DocsContent'

export const metadata: Metadata = {
  title: 'Documentation | OMNIUM',
  description: 'Technical documentation for OMNIUM - architecture, economics layer, and implementation details.',
}

export default function DocsPage() {
  return <DocsContent />
}

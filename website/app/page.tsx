import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { ProblemSection } from '@/components/ProblemSection'
import { SolutionSection } from '@/components/SolutionSection'
import { DimensionExplorer } from '@/components/DimensionExplorer'
import {
  TemporalDeepDive,
  LocalityDeepDive,
  PurposeDeepDive,
  ReputationDeepDive,
} from '@/components/dimensions'
import { Playground } from '@/components/Playground'
import { VisionSection } from '@/components/VisionSection'
import { Footer } from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <Header />

      {/* Opening */}
      <Hero />

      {/* The Story */}
      <ProblemSection />
      <SolutionSection />

      {/* Interactive Overview */}
      <DimensionExplorer />

      {/* Deep Dives */}
      <TemporalDeepDive />
      <LocalityDeepDive />
      <PurposeDeepDive />
      <ReputationDeepDive />

      {/* Try It */}
      <Playground />

      {/* Closing */}
      <VisionSection />
      <Footer />
    </main>
  )
}

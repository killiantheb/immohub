import { Navbar } from "@/components/landing/Navbar"
import { Hero } from "@/components/landing/Hero"
import { SocialProof } from "@/components/landing/SocialProof"
import { PourQui } from "@/components/landing/PourQui"
import { FeatureBiens } from "@/components/landing/FeatureBiens"
import { FeatureIA } from "@/components/landing/FeatureIA"
import { FeatureReseau } from "@/components/landing/FeatureReseau"
import { Tarifs } from "@/components/landing/Tarifs"
import { Testimonials } from "@/components/landing/Testimonials"
import { Garanties } from "@/components/landing/Garanties"
import { CTAFinal } from "@/components/landing/CTAFinal"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <div style={{ background: "#FAF8F4", minHeight: "100vh", overflowX: "hidden" }}>
      <Navbar />
      <Hero />
      <SocialProof />
      <PourQui />
      <FeatureBiens />
      <FeatureIA />
      <FeatureReseau />
      <Tarifs />
      <Testimonials />
      <Garanties />
      <CTAFinal />
      <Footer />
    </div>
  )
}

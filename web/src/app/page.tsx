import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import HeroSection from '@/components/sections/HeroSection';
import FeaturesSection from '@/components/sections/FeaturesSection';
import HowItWorksSection from '@/components/sections/HowItWorksSection';
import SocialProofSection from '@/components/sections/SocialProofSection';
import FinalCtaSection from '@/components/sections/FinalCtaSection';

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <SocialProofSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}

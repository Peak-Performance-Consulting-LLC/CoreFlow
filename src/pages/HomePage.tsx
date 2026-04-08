import { FeaturesSection } from '../components/home/FeaturesSection';
import { FinalCtaSection } from '../components/home/FinalCtaSection';
import { HeroSection } from '../components/home/HeroSection';
import { HomeFooter } from '../components/home/HomeFooter';
import { HomeNavbar } from '../components/home/HomeNavbar';
import { HowItWorksSection } from '../components/home/HowItWorksSection';
import { IndustryModesSection } from '../components/home/IndustryModesSection';
import { TestimonialsSection } from '../components/home/TestimonialsSection';
import { AnimatedBackground } from '../components/ui/AnimatedBackground';

export function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <AnimatedBackground className="opacity-70" />
      <HomeNavbar />
      <HeroSection />
      <FeaturesSection />
      <IndustryModesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FinalCtaSection />
      <HomeFooter />
    </div>
  );
}

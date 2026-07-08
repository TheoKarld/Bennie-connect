/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import LandingNav from "./sections/LandingNav";
import HeroSection from "./sections/HeroSection";
import FeaturesSection from "./sections/FeaturesSection";
import HowItWorksSection from "./sections/HowItWorksSection";
import TiersSection from "./sections/TiersSection";
import SocialProofSection from "./sections/SocialProofSection";
import CtaSection from "./sections/CtaSection";
import LandingFooter from "./sections/LandingFooter";

/**
 * Marketing landing page for Bennie Connect — the Cooperative Farming Portal.
 * Single-page, sectioned. Logic-free / presentational; each section lives in
 * ./sections and reuses the brand tokens from src/index.css.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth bg-canvas text-ink antialiased">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TiersSection />
        <SocialProofSection />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasUsedFreeAnalysis } from '../lib/usageLocal';
import { isPaywallLanding } from '../lib/paywallMode';

export function HomeStickyCta({ analysisCredits = 0 }) {
  const [visible, setVisible] = useState(false);
  const freeUsed = hasUsedFreeAnalysis() && analysisCredits <= 0;
  const paywall = isPaywallLanding();
  const hasCredits = analysisCredits > 0;

  useEffect(() => {
    if (freeUsed || paywall || hasCredits) return undefined;

    const hero = document.querySelector('.hero');
    if (!hero) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-20px 0px 0px 0px' },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [freeUsed, paywall, hasCredits]);

  if (!visible || freeUsed || paywall || hasCredits) return null;

  return (
    <div className="home-sticky-cta" role="complementary" aria-label="התחל ניתוח חינם">
      <Link to="/analyze" className="home-sticky-cta__link">
        <span>ניתוח ראשון חינם</span>
        <span className="home-sticky-cta__arrow" aria-hidden="true">←</span>
      </Link>
    </div>
  );
}

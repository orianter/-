import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatOfferCountdown, getDiscountedPrice, getIntroOffer } from '../lib/introOffer';
import { PRICING_PLANS } from '../data/content';

const MONTHLY_PLAN = PRICING_PLANS.find((p) => p.id === 'monthly');

export function IntroOfferBanner({ variant = 'report' }) {
  const [offer, setOffer] = useState(() => getIntroOffer());

  useEffect(() => {
    const tick = () => setOffer(getIntroOffer());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!offer?.active || !MONTHLY_PLAN) return null;

  const discounted = getDiscountedPrice(MONTHLY_PLAN.price, offer.discountPercent);
  const countdown = formatOfferCountdown(offer.expiresAt);

  if (variant === 'pricing') {
    return (
      <div className="intro-offer intro-offer--pricing" role="status">
        <span className="intro-offer__tag">הצעה מוגבלת</span>
        <p className="intro-offer__title">
          {offer.discountPercent}% הנחה על המסלול החודשי — חודש ראשון בלבד
        </p>
        <p className="intro-offer__price">
          <span className="intro-offer__was">₪{MONTHLY_PLAN.price}</span>
          <strong>₪{discounted}</strong>
          <span className="intro-offer__note">לחודש הראשון · אחר כך ₪{MONTHLY_PLAN.price}</span>
        </p>
        <p className="intro-offer__timer">נותר: {countdown}</p>
      </div>
    );
  }

  return (
    <div className="intro-offer intro-offer--report" role="region" aria-label="הצעת מבצע">
      <div className="intro-offer__inner">
        <span className="intro-offer__tag">מבצע לזמן מוגבל</span>
        <h3 className="intro-offer__title">
          אהבת את הניתוח? {offer.discountPercent}% הנחה על המסלול החודשי
        </h3>
        <p className="intro-offer__desc">
          חודש ראשון ב-<strong>₪{discounted}</strong> במקום ₪{MONTHLY_PLAN.price} · עד 30 ניתוחים בחודש
        </p>
        <p className="intro-offer__timer">⏱ נותר: {countdown}</p>
        <Link to="/?pricing=1#pricing" className="btn-hero btn-hero--sm intro-offer__cta">
          בחר מסלול עם הנחה ←
        </Link>
      </div>
    </div>
  );
}

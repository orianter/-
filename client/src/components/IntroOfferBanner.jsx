import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatOfferCountdownLive, getDiscountedPrice, getIntroOffer } from '../lib/introOffer';
import { PRICING_PLANS } from '../data/content';
import { goToPricing } from '../lib/goToPricing';
import { startCheckout } from '../lib/planCheckout';

const MONTHLY_PLAN = PRICING_PLANS.find((p) => p.id === 'monthly');

export function IntroOfferBanner({ variant = 'report', onCheckout }) {
  const [offer, setOffer] = useState(() => getIntroOffer());

  useEffect(() => {
    const tick = () => setOffer(getIntroOffer());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!offer?.active || !MONTHLY_PLAN) return null;

  const discounted = getDiscountedPrice(MONTHLY_PLAN.price, offer.discountPercent);
  const countdown = formatOfferCountdownLive(offer.expiresAt);

  const handleCheckout = () => {
    startCheckout('monthly', { introOffer: offer, openModal: onCheckout });
  };

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
        <p className="intro-offer__timer intro-offer__timer--live">⏱ נותר: {countdown}</p>
      </div>
    );
  }

  return (
    <div className="intro-offer intro-offer--report" role="region" aria-label="הצעת מבצע">
      <div className="intro-offer__inner">
        <span className="intro-offer__tag">מבצע לזמן מוגבל — אל תפספס</span>
        <h3 className="intro-offer__title">
          אהבת את הניתוח? {offer.discountPercent}% הנחה על המסלול החודשי
        </h3>
        <p className="intro-offer__desc">
          חודש ראשון ב-<strong>₪{discounted}</strong> במקום ₪{MONTHLY_PLAN.price} · עד 30 ניתוחים בחודש
        </p>
        <p className="intro-offer__social">רוב המשתמשים בוחרים מסלול חודשי אחרי הניתוח הראשון</p>
        <p className="intro-offer__timer intro-offer__timer--live">⏱ נותר: {countdown}</p>
        {onCheckout ? (
          <button type="button" className="btn-hero intro-offer__cta intro-offer__cta--lg" onClick={handleCheckout}>
            קבל {offer.discountPercent}% הנחה — ₪{discounted} ←
          </button>
        ) : (
          <Link to="/?pricing=1#pricing" className="btn-hero intro-offer__cta intro-offer__cta--lg">
            קבל {offer.discountPercent}% הנחה — ₪{discounted} ←
          </Link>
        )}
      </div>
    </div>
  );
}

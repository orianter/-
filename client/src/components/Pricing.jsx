import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRICING_BILLING, PRICING_PLANS } from '../data/content';
import { IntroOfferBanner } from './IntroOfferBanner';
import { Reveal } from './Reveal';
import { getDiscountedPrice, getIntroOffer } from '../lib/introOffer';

export function Pricing() {
  const [billing, setBilling] = useState('monthly');
  const [offer, setOffer] = useState(() => getIntroOffer());

  useEffect(() => {
    const tick = () => setOffer(getIntroOffer());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const visiblePlans = PRICING_PLANS.filter((plan) => {
    if (plan.billing === 'once') return true;
    if (billing === 'weekly') return plan.billing === 'weekly' || plan.billing === 'once';
    return plan.billing === 'monthly' || plan.billing === 'once';
  });

  return (
    <section id="pricing" className="pricing">
      <div className="section-wrap">
        <div className="section-head">
          <span className="section-tag">תמחור הוגן</span>
          <h2>מסלול שבועי, חודשי או בודד</h2>
          <p>הניתוח הראשון חינם · בלי התחייבות</p>
        </div>

        {offer?.active && <IntroOfferBanner variant="pricing" />}

        <div className="pricing__toggle" role="tablist" aria-label="סוג מסלול">
          {(['weekly', 'monthly']).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={billing === key}
              className={`pricing__toggle-btn ${billing === key ? 'pricing__toggle-btn--active' : ''}`}
              onClick={() => setBilling(key)}
            >
              {PRICING_BILLING[key].label}
            </button>
          ))}
        </div>
        <p className="pricing__toggle-hint">{PRICING_BILLING[billing].hint}</p>

        <div className={`pricing__grid pricing__grid--${visiblePlans.length}`}>
          {visiblePlans.map((plan, i) => {
            const hasIntroDiscount = offer?.active && plan.id === offer.planId;
            const displayPrice = hasIntroDiscount
              ? getDiscountedPrice(plan.price, offer.discountPercent)
              : plan.price;
            const showStrikethrough = hasIntroDiscount || plan.originalPrice;

            return (
              <Reveal
                key={plan.id}
                delay={i * 90}
                className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''} ${plan.pro ? 'pricing-card--pro' : ''} ${hasIntroDiscount ? 'pricing-card--offer' : ''}`}
              >
                {hasIntroDiscount && (
                  <span className="pricing-card__badge pricing-card__badge--offer">
                    {offer.discountPercent}% הנחה · חודש ראשון
                  </span>
                )}
                {!hasIntroDiscount && plan.badge && (
                  <span className="pricing-card__badge">{plan.badge}</span>
                )}
                <h3>{plan.name}</h3>
                <p className="pricing-card__desc">{plan.desc}</p>
                <div className="pricing-card__price">
                  <div className="pricing-card__amount-row">
                    {showStrikethrough && (
                      <span className="pricing-card__original">
                        ₪{hasIntroDiscount ? plan.price : plan.originalPrice}
                      </span>
                    )}
                    <span className="pricing-card__amount">₪{displayPrice}</span>
                  </div>
                  <span className="pricing-card__period">
                    {hasIntroDiscount ? 'לחודש הראשון' : plan.period}
                  </span>
                  {hasIntroDiscount && (
                    <span className="pricing-card__perunit">אחר כך ₪{plan.price} לחודש</span>
                  )}
                  {!hasIntroDiscount && plan.perUnit && (
                    <span className="pricing-card__perunit">{plan.perUnit}</span>
                  )}
                </div>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>
                      <span className="pricing-card__check">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/analyze"
                  className={
                    plan.popular || hasIntroDiscount
                      ? 'btn-hero btn-hero--sm btn-hero--full'
                      : 'btn-hero-ghost btn-hero-ghost--full'
                  }
                >
                  {hasIntroDiscount ? `התחל ב-₪${displayPrice} ←` : plan.cta}
                </Link>
              </Reveal>
            );
          })}
        </div>

        <div className="pricing__guarantee">
          <span className="pricing__guarantee-icon">🛡️</span>
          <div>
            <strong>ניתוח ראשון חינם + 14 יום החזר כספי מלא</strong>
            <p>נסה בלי כרטיס אשראי. הדוח הוא המלצה — לא הבטחת תוצאות. לא אהבת? החזר מלא.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

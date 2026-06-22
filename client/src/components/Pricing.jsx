import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRICING_BILLING, PRICING_OBJECTIONS, PRICING_PLANS } from '../data/content';
import { IntroOfferBanner } from './IntroOfferBanner';
import { Reveal } from './Reveal';
import { getDiscountedPrice, getIntroOffer } from '../lib/introOffer';
import { getPlanCta, startCheckout } from '../lib/planCheckout';
import { isPaywallLanding } from '../lib/paywallMode';
import { hasUsedFreeAnalysis } from '../lib/usageLocal';

export function Pricing({ onCheckout, analysisCredits = 0 }) {
  const paywall = isPaywallLanding();
  const freeUsed = hasUsedFreeAnalysis() && analysisCredits <= 0;
  const [billing, setBilling] = useState(() => {
    if (paywall && getIntroOffer()?.active) return 'monthly';
    if (paywall) return 'monthly';
    return 'annual';
  });
  const [offer, setOffer] = useState(() => getIntroOffer());

  useEffect(() => {
    if (paywall && getIntroOffer()?.active) setBilling('monthly');
  }, [paywall]);

  useEffect(() => {
    const tick = () => setOffer(getIntroOffer());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const visiblePlans = PRICING_PLANS.filter((plan) => {
    if (plan.billing === 'once') return true;
    if (billing === 'annual') return plan.billing === 'annual';
    return plan.billing === 'monthly';
  });

  const handlePlanClick = (plan) => {
    const cta = getPlanCta(plan, { freeUsed, paywall, introOffer: offer, analysisCredits });
    if (cta.type === 'checkout') {
      startCheckout(plan.id, { introOffer: offer, openModal: onCheckout });
    }
  };

  return (
    <section id="pricing" className={`pricing ${paywall ? 'pricing--paywall' : ''}`}>
      <div className="section-wrap">
        <div className="section-head">
          <span className="section-tag">תמחור הוגן</span>
          <h2>{paywall ? 'בחר מסלול והמשך לנתח' : 'חודשי או שנתי — מה שנוח לך'}</h2>
          <p>
            {paywall
              ? 'הניתוח החינמי נוצל · 14 יום החזר כספי מלא'
              : 'תצוגה מקדימה חינם · שנתי חוסך עד 27%'}
          </p>
        </div>

        {offer?.active && <IntroOfferBanner variant="pricing" />}

        <div className="pricing__toggle" role="tablist" aria-label="סוג מסלול">
          {(['monthly', 'annual']).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={billing === key}
              className={`pricing__toggle-btn ${billing === key ? 'pricing__toggle-btn--active' : ''}`}
              onClick={() => setBilling(key)}
            >
              {PRICING_BILLING[key].label}
              {PRICING_BILLING[key].recommended && (
                <span className="pricing__toggle-badge">מומלץ</span>
              )}
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
            const cta = getPlanCta(plan, { freeUsed, paywall, introOffer: offer, analysisCredits });
            const isHighlighted =
              (paywall || offer?.active) && plan.id === 'monthly' && billing === 'monthly';
            const isAnnualFeatured = billing === 'annual' && plan.billing === 'annual' && plan.popular;
            const btnClass =
              plan.popular || hasIntroDiscount || isHighlighted
                ? 'btn-hero btn-hero--sm btn-hero--full'
                : 'btn-hero-ghost btn-hero-ghost--full';

            return (
              <Reveal
                key={plan.id}
                delay={i * 90}
                className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''} ${plan.pro ? 'pricing-card--pro' : ''} ${hasIntroDiscount ? 'pricing-card--offer' : ''} ${isHighlighted || isAnnualFeatured ? 'pricing-card--pulse' : ''}`}
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
                  {plan.monthlyEquivalent && !hasIntroDiscount && (
                    <span className="pricing-card__perunit">
                      ~₪{plan.monthlyEquivalent} לחודש · {plan.badge || 'חיסכון'}
                    </span>
                  )}
                  {hasIntroDiscount && (
                    <span className="pricing-card__perunit">אחר כך ₪{plan.price} לחודש</span>
                  )}
                  {!hasIntroDiscount && !plan.monthlyEquivalent && plan.perUnit && (
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
                {cta.type === 'free' ? (
                  <Link to={cta.href} className={btnClass}>
                    {cta.label}
                  </Link>
                ) : (
                  <button type="button" className={btnClass} onClick={() => handlePlanClick(plan)}>
                    {cta.label}
                  </button>
                )}
              </Reveal>
            );
          })}
        </div>

        <div className="pricing__objections" aria-label="שאלות נפוצות על התשלום">
          {PRICING_OBJECTIONS.map((item) => (
            <div key={item.q} className="pricing__objection">
              <strong>{item.q}</strong>
              <p>
                {item.a}
                {item.link && (
                  <>
                    {' '}
                    <a href={item.link.href}>{item.link.label}</a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="pricing__guarantee">
          <span className="pricing__guarantee-icon">🛡️</span>
          <div>
            <strong>תצוגה מקדימה חינם + 14 יום החזר כספי מלא</strong>
            <p>נסה בלי כרטיס אשראי. הדוח הוא המלצה — לא הבטחת תוצאות. לא אהבת? החזר מלא.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

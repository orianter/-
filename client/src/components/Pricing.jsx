import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PRICING_BILLING, PRICING_PLANS } from '../data/content';
import { Reveal } from './Reveal';

export function Pricing() {
  const [billing, setBilling] = useState('monthly');

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
          {visiblePlans.map((plan, i) => (
            <Reveal
              key={plan.id}
              delay={i * 90}
              className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''} ${plan.pro ? 'pricing-card--pro' : ''}`}
            >
              {plan.badge && <span className="pricing-card__badge">{plan.badge}</span>}
              <h3>{plan.name}</h3>
              <p className="pricing-card__desc">{plan.desc}</p>
              <div className="pricing-card__price">
                <div className="pricing-card__amount-row">
                  {plan.originalPrice && (
                    <span className="pricing-card__original">₪{plan.originalPrice}</span>
                  )}
                  <span className="pricing-card__amount">₪{plan.price}</span>
                </div>
                <span className="pricing-card__period">{plan.period}</span>
                {plan.perUnit && <span className="pricing-card__perunit">{plan.perUnit}</span>}
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
                  plan.popular
                    ? 'btn-hero btn-hero--sm btn-hero--full'
                    : 'btn-hero-ghost btn-hero-ghost--full'
                }
              >
                {plan.cta}
              </Link>
            </Reveal>
          ))}
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

import { Link } from 'react-router-dom';
import { PRICING_PLANS } from '../data/content';
import { Reveal } from './Reveal';

export function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <div className="section-wrap">
        <div className="section-head">
          <span className="section-tag">תמחור הוגן</span>
          <h2>מחיר שלא תרגיש</h2>
          <p>הניתוח הראשון חינם · פחות מקפה לדוח · בלי התחייבות</p>
        </div>

        <div className="pricing__grid">
          {PRICING_PLANS.map((plan, i) => (
            <Reveal
              key={plan.id}
              delay={i * 90}
              className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''}`}
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
            <p>נסה בלי כרטיס אשראי. לא אהבת את הדוח? קיבלת את הכסף בחזרה, בלי שאלות.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

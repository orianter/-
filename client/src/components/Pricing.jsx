import { Link } from 'react-router-dom';
import { PRICING_PLANS } from '../data/content';

export function Pricing() {
  return (
    <section id="pricing" className="pricing">
      <div className="section-wrap">
        <div className="section-head">
          <span className="section-tag">תמחור פשוט</span>
          <h2>כמה זה עולה?</h2>
          <p>פחות מקפה אחד — יותר משווה ליועץ תוכן</p>
        </div>

        <div className="pricing__grid">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card ${plan.popular ? 'pricing-card--popular' : ''}`}
            >
              {plan.popular && <span className="pricing-card__badge">הכי משתלם</span>}
              <h3>{plan.name}</h3>
              <p className="pricing-card__desc">{plan.desc}</p>
              <div className="pricing-card__price">
                <span className="pricing-card__amount">₪{plan.price}</span>
                <span className="pricing-card__period">{plan.period}</span>
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
                className={plan.popular ? 'btn-hero btn-hero--sm btn-hero--full' : 'btn-hero-ghost btn-hero-ghost--full'}
              >
                {plan.id === 'business' ? 'בקרוב' : 'נסה בחינם'}
              </Link>
            </div>
          ))}
        </div>

        <p className="pricing__note">
          * כרגע הניתוח פתוח לבדיקה בחינם. תשלום בכרטיס אשראי יתווסף בקרוב.
          עלות הניתוח לך: פחות מ־₪1 (AI).
        </p>
      </div>
    </section>
  );
}

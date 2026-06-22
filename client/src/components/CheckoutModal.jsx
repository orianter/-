import { useEffect } from 'react';
import { openContactFallback } from '../lib/planCheckout';

export function CheckoutModal({ state, onClose }) {
  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const { plan, displayPrice, introOffer } = state;
  const hasDiscount = introOffer?.active && plan.id === introOffer.planId;

  return (
    <div className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button type="button" className="checkout-modal__backdrop" aria-label="סגור" onClick={onClose} />
      <div className="checkout-modal__panel">
        <button type="button" className="checkout-modal__close" aria-label="סגור" onClick={onClose}>
          ✕
        </button>
        <span className="checkout-modal__tag">סיכום הזמנה</span>
        <h2 id="checkout-title">{plan.name}</h2>
        <p className="checkout-modal__desc">{plan.desc}</p>
        <div className="checkout-modal__price">
          {hasDiscount && (
            <span className="checkout-modal__was">₪{plan.price}</span>
          )}
          <strong>₪{displayPrice}</strong>
          <span>{hasDiscount ? 'לחודש הראשון' : plan.period}</span>
        </div>
        <ul className="checkout-modal__features">
          {plan.features.slice(0, 4).map((f) => (
            <li key={f}>
              <span aria-hidden="true">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="checkout-modal__note">
          14 יום החזר כספי מלא · הדוח הוא המלצה — לא הבטחת תוצאות
        </p>
        <button
          type="button"
          className="btn-hero btn-hero--full"
          onClick={() => {
            openContactFallback(plan, displayPrice, introOffer);
            onClose();
          }}
        >
          להמשך תשלום ←
        </button>
        <button type="button" className="checkout-modal__secondary" onClick={onClose}>
          חזרה למסלולים
        </button>
      </div>
    </div>
  );
}

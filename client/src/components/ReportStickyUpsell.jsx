import { useNavigate } from 'react-router-dom';
import { getIntroOffer, getDiscountedPrice } from '../lib/introOffer';
import { PRICING_PLANS } from '../data/content';
import { goToPricing } from '../lib/goToPricing';
import { startCheckout } from '../lib/planCheckout';

export function ReportStickyUpsell({ onCheckout }) {
  const navigate = useNavigate();
  const offer = getIntroOffer();
  const monthly = PRICING_PLANS.find((p) => p.id === 'monthly');
  const basePrice = monthly?.price ?? 79;
  const displayPrice = offer?.active ? getDiscountedPrice(basePrice, offer.discountPercent) : basePrice;

  const handleClick = () => {
    if (offer?.active) {
      startCheckout('monthly', { introOffer: offer, openModal: onCheckout });
    } else {
      goToPricing(navigate);
    }
  };

  return (
    <div className="report-sticky-upsell" role="complementary" aria-label="המשך לניתוח הבא">
      <div className="report-sticky-upsell__inner">
        <div className="report-sticky-upsell__text">
          <strong>נתח את הרילס הבא</strong>
          <span>
            {offer?.active ? (
              <>
                <s>₪{basePrice}</s> ₪{displayPrice}/חודש ראשון
              </>
            ) : (
              <>מ-₪{basePrice}/חודש</>
            )}
          </span>
        </div>
        <button type="button" className="btn-hero btn-hero--sm report-sticky-upsell__btn" onClick={handleClick}>
          המשך ←
        </button>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { getIntroOffer, getDiscountedPrice } from '../lib/introOffer';
import { PRICING_PLANS } from '../data/content';
import { goToPricing } from '../lib/goToPricing';
import { startCheckout } from '../lib/planCheckout';

const WEAK_COPY = {
  hook: {
    headline: 'שיפרת את הפתיחה?',
    body: 'נתח את הגרסה הבאה וראה אם הציון עלה — עד 30 ניתוחים בחודש.',
  },
  pacing: {
    headline: 'ערכת את הקצב?',
    body: 'בדוק את הסרטון המשופר עם מסלול חודשי — משוב מיידי לפני שמעלים.',
  },
  message: {
    headline: 'הוספת CTA ברור?',
    body: 'וודא שהשינוי עובד — נתח את הגרסה הבאה וקבל השוואה.',
  },
  visual: {
    headline: 'שיפרת את הויזואל?',
    body: 'נתח את הגרסה המעודכנת — טקסט, תאורה וחדות נבדקים שוב.',
  },
  audio: {
    headline: 'תיקנת את האודיו?',
    body: 'בדוק שהדיבור והקצב עובדים — ניתוח הבא בלחיצה.',
  },
  platformFit: {
    headline: 'התאמת לפלטפורמה?',
    body: 'נתח את הסרטון המותאם — TikTok ו-Reels בנפרד.',
  },
};

const DEFAULT_COPY = {
  headline: 'מוכן לסרטון הבא?',
  body: 'יישם את ההמלצות ונתח שוב — כך תראה אם הציון עולה.',
};

function pickWeakestKey(categories) {
  if (!categories) return null;
  let weakest = null;
  let lowest = 11;
  for (const [key, cat] of Object.entries(categories)) {
    if (typeof cat?.score === 'number' && cat.score < lowest) {
      lowest = cat.score;
      weakest = key;
    }
  }
  return lowest <= 6 ? weakest : null;
}

export function ReportUpgradeCTA({ categories, onCheckout }) {
  const navigate = useNavigate();
  const offer = getIntroOffer();
  const monthly = PRICING_PLANS.find((p) => p.id === 'monthly');
  const weakKey = pickWeakestKey(categories);
  const copy = (weakKey && WEAK_COPY[weakKey]) || DEFAULT_COPY;
  const price = monthly
    ? offer?.active
      ? getDiscountedPrice(monthly.price, offer.discountPercent)
      : monthly.price
    : 79;

  const handleCta = () => {
    if (offer?.active) {
      startCheckout('monthly', { introOffer: offer, openModal: onCheckout });
    } else {
      goToPricing(navigate);
    }
  };

  return (
    <section className="report-upgrade-cta" aria-label="שדרוג לניתוחים נוספים">
      <div className="report-upgrade-cta__inner">
        <span className="report-upgrade-cta__tag">הצעד הבא</span>
        <h3>{copy.headline}</h3>
        <p>{copy.body}</p>
        {offer?.active && (
          <p className="report-upgrade-cta__offer">
            מסלול חודשי ב-<strong>₪{price}</strong> לחודש הראשון · 30% הנחה ל-48 שעות
          </p>
        )}
        <button type="button" className="btn-hero btn-hero--sm" onClick={handleCta}>
          {offer?.active ? `נתח את הגרסה הבאה — ₪${price} ←` : 'בחר מסלול להמשך ←'}
        </button>
      </div>
    </section>
  );
}

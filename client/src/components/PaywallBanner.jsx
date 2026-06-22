import { useEffect, useState } from 'react';
import { formatOfferCountdownLive, getIntroOffer } from '../lib/introOffer';

export function PaywallBanner() {
  const [offer, setOffer] = useState(() => getIntroOffer());

  useEffect(() => {
    const tick = () => setOffer(getIntroOffer());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="paywall-banner" role="status">
      <div className="paywall-banner__inner">
        <span className="paywall-banner__icon" aria-hidden="true">🔒</span>
        <div>
          <strong>הניתוח החינמי הסתיים — בחר מסלול להמשך</strong>
          <p>
            {offer?.active
              ? `הנחת ${offer.discountPercent}% על המסלול החודשי — נותר ${formatOfferCountdownLive(offer.expiresAt)}`
              : 'בחר מסלול ותמשיך לנתח סרטונים נוספים'}
          </p>
        </div>
      </div>
    </div>
  );
}

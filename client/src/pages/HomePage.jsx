import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DemoReportPreview } from '../components/DemoReport';
import { FAQ } from '../components/FAQ';
import { Pricing } from '../components/Pricing';
import { Reveal } from '../components/Reveal';
import { AiDisclaimer } from '../components/AiDisclaimer';
import { CheckoutModal } from '../components/CheckoutModal';
import { HomeStickyCta } from '../components/HomeStickyCta';
import { PaywallBanner } from '../components/PaywallBanner';
import { COMPARISON, TESTIMONIALS, TRUST_STATS } from '../data/content';
import { analyzeHeaders } from '../api';
import {
  canRunFullAnalysis,
  fetchAnalysisAccess,
  hasUsedFreeAnalysis,
  setPaymentSuccessNotice,
  syncFreeAnalysisFromApi,
} from '../lib/usageLocal';
import { isPaywallLanding } from '../lib/paywallMode';

const STEPS = [
  { num: '1', title: 'העלה סרטון', desc: 'גרור רילס עד 2 דקות — MP4, MOV או WebM. הסרטון לא נשמר בשרת', icon: '📤' },
  { num: '2', title: 'ספר מה קורה בו', desc: 'פלטפורמה, מטרה, קהל — וחובה: מה נאמר/כתוב בסרטון (עם שניות)', icon: '📝' },
  { num: '3', title: 'קבל דוח מלא', desc: 'ציונים, ממצאים עם ראיה, תיקונים, פתיחה ותסריט — הכל בעברית', icon: '📊' },
];

const AUDIENCE = [
  { icon: '🎬', title: 'יוצרי תוכן', desc: 'לדעת למה רילס לא תפס לפני שמעלים את הבא' },
  { icon: '🏪', title: 'עסקים קטנים', desc: 'מסעדות, חנויות, נותני שירות — בלי סוכנות' },
  { icon: '📱', title: 'סוכנויות סושיאל', desc: 'דוח מקצועי לשלוח ללקוח בלחיצה' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState(null);
  const [analysisAccess, setAnalysisAccess] = useState(null);
  const [paymentBanner, setPaymentBanner] = useState(null);
  const paywall = isPaywallLanding();
  const analysisCredits = analysisAccess?.analysisCredits || 0;
  const freeUsed = hasUsedFreeAnalysis() && !canRunFullAnalysis(analysisAccess);
  const hasCredits = canRunFullAnalysis(analysisAccess);

  useEffect(() => {
    let cancelled = false;
    fetchAnalysisAccess()
      .then((data) => {
        if (cancelled) return;
        setAnalysisAccess(data);
        syncFreeAnalysisFromApi(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('pricing') || params.get('paywall') || window.location.hash === '#pricing') {
      const timer = setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return undefined;

    const orderId = params.get('order')?.trim() || '';
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const headers = await analyzeHeaders();
        const query = orderId ? `?order=${encodeURIComponent(orderId)}` : '';
        const res = await fetch(`/api/payment/status${query}`, {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'paid' || (data.analysisCredits || 0) > 0) {
          setPaymentBanner({
            credits: data.analysisCredits || data.creditsGranted || 0,
            granted: data.creditsGranted,
          });
          setAnalysisAccess((prev) => ({
            ...(prev || {}),
            analysisCredits: data.analysisCredits || 0,
            canAnalyzeFull: (data.analysisCredits || 0) > 0,
            freeRemaining: 0,
          }));
          syncFreeAnalysisFromApi({
            analysisCredits: data.analysisCredits || 0,
            freeRemaining: 0,
          });
          window.history.replaceState({}, '', '/');
          setPaymentSuccessNotice(data.analysisCredits || data.creditsGranted || 0);
          setTimeout(() => {
            if (!cancelled) navigate('/analyze');
          }, 2500);
          return;
        }
      } catch {
        /* retry */
      }

      if (attempts < 8 && !cancelled) {
        setTimeout(poll, 2000);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className={`landing ${paywall ? 'landing--paywall' : ''}`}>
      {paywall && <PaywallBanner />}

      {paymentBanner && (
        <div className="analyze-alert analyze-alert--ok landing__payment-banner" role="status">
          <strong>✓ התשלום הושלם!</strong>
          {' '}
          {paymentBanner.credits
            ? `נוספו ${paymentBanner.credits} ניתוחים מלאים — מעבירים אותך לניתוח…`
            : 'מעבירים אותך לניתוח…'}
        </div>
      )}

      {hasCredits && !paymentBanner && (
        <div className="analyze-alert analyze-alert--ok landing__payment-banner" role="status">
          <strong>✓ יש לך {analysisCredits} ניתוחים מלאים</strong>
          {' '}
          <Link to="/analyze">התחל ניתוח ←</Link>
        </div>
      )}

      <section className="hero">
        <div className="hero__glow" />
        <div className="hero__grid" />
        <div className="hero__content">
          <span className="hero__pill">
            <span className="hero__pill-dot" />
            {freeUsed ? 'בחר מסלול להמשך' : 'תצוגה מקדימה · בלי כרטיס אשראי'}
          </span>
          <h1>
            גלה למה הרילס שלך
            <br />
            <span className="hero__gradient">לא תפס</span>
            {' '}— ומה לשנות
          </h1>
          <p className="hero__sub">
            העלה סרטון וקבל <strong>משוב מסודר תוך דקה</strong>: ציונים, מה לתקן ותסריט משופר.
            {' '}<strong>14 יום החזר כספי</strong> אם לא תרגיש שזה עזר — הדוח הוא המלצה, לא הבטחה.
          </p>
          {!freeUsed && (
            <p className="hero__scarcity">תצוגה מקדימה חינם — דוח מלא מ-₪58/חודש (שנתי)</p>
          )}
          <div className="hero__actions">
            {freeUsed ? (
              <a href="#pricing" className="btn-hero">
                בחר מסלול
                <span>←</span>
              </a>
            ) : (
              <Link to="/analyze" className="btn-hero">
                {freeUsed ? 'בחר מסלול ←' : 'קבל תצוגה מקדימה'}
                <span>←</span>
              </Link>
            )}
            <a href="#demo" className="btn-hero-ghost">ראה דוגמת דוח</a>
          </div>
          <div className="hero__social">
            <span className="hero__stars" aria-hidden="true">★★★★★</span>
            <span>משוב ליוצרי תוכן · דוגמאות למטה</span>
          </div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="section-wrap">
          <div className="trust-strip__grid">
            {TRUST_STATS.map((s) => (
              <div key={s.label} className="trust-stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="audience">
        <div className="section-wrap">
          {AUDIENCE.map((a, i) => (
            <Reveal key={a.title} delay={i * 90} className="audience-card">
              <span className="audience-card__icon">{a.icon}</span>
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" className="how">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">פשוט ומהיר</span>
            <h2>איך זה עובד?</h2>
            <p>3 צעדים · התחברות מהירה עם Google</p>
          </div>
          <div className="how__steps">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 90} className="how-step">
                <div className="how-step__icon">{step.icon}</div>
                <span className="how-step__num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </Reveal>
            ))}
          </div>
          <div className="how__cta">
            {freeUsed ? (
              <a href="#pricing" className="btn-hero btn-hero--sm">בחר מסלול להמשך</a>
            ) : (
              <Link to="/analyze" className="btn-hero btn-hero--sm">התחל עכשיו — זה חינם</Link>
            )}
          </div>
        </div>
      </section>

      <section className="compare">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">למה זה שווה</span>
            <h2>מניחוש — לכיוון ממוקד</h2>
            <p>ההבדל בין להעלות בתקווה לבין לקבל משוב מסודר לפני/אחרי העלאה</p>
          </div>
          <div className="compare__cols">
            <Reveal className="compare-card compare-card--bad">
              <h3><span className="compare-card__icon">✕</span> בלי Reel Analyzer</h3>
              <ul>
                {COMPARISON.without.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120} className="compare-card compare-card--good">
              <h3><span className="compare-card__icon">✓</span> עם Reel Analyzer</h3>
              <ul>
                {COMPARISON.with.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="demo" className="demo">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">דוגמה אמיתית</span>
            <h2>ככה נראה הדוח</h2>
            <p>כך ייראה דוח לדוגמה — הניתוח שלך יתבסס על הסרטון והפרטים שתמלא</p>
          </div>
          <Reveal>
            <DemoReportPreview />
          </Reveal>
        </div>
      </section>

      <section className="testimonials">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">מה אומרים</span>
            <h2>יוצרים שכבר שיפרו</h2>
            <p>דוגמאות לסגנון משוב — לא תוצאות מובטחות</p>
          </div>
          <div className="testimonials__grid">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 90} className="testimonial-card">
                <span className="testimonial-card__stars">★★★★★</span>
                <p className="testimonial-card__quote">"{t.quote}"</p>
                <div className="testimonial-card__author">
                  <span className="testimonial-card__avatar">{t.avatar}</span>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.role}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="testimonials__cta">
            {freeUsed ? (
              <a href="#pricing" className="btn-hero btn-hero--sm">בחר מסלול ותמשיך לנתח ←</a>
            ) : (
              <Link to="/analyze" className="btn-hero btn-hero--sm">נסה על הסרטון שלך — חינם ←</Link>
            )}
          </div>
        </div>
      </section>

      <Pricing onCheckout={setCheckout} analysisCredits={analysisCredits} />
      <section id="ai-disclaimer" className="ai-disclaimer-section">
        <div className="section-wrap section-wrap--narrow">
          <AiDisclaimer />
        </div>
      </section>
      <FAQ />

      <section className="final-cta">
        <div className="final-cta__box">
          <div className="final-cta__glow" />
          <span className="section-tag">מתחילים?</span>
          <h2>מוכן לשפר את הרילס הבא?</h2>
          <p>
            {freeUsed
              ? 'בחר מסלול והמשך לנתח — 14 יום החזר כספי מלא'
              : 'הניתוח הראשון חינם · אחרי הניתוח — 30% הנחה על מסלול חודשי ל-48 שעות'}
          </p>
          {freeUsed ? (
            <a href="#pricing" className="btn-hero">
              לבחירת מסלול
              <span>←</span>
            </a>
          ) : (
            <Link to="/analyze" className="btn-hero">
              נתח את הסרטון שלי
              <span>←</span>
            </Link>
          )}
        </div>
      </section>

      <HomeStickyCta analysisCredits={analysisCredits} />
      <CheckoutModal state={checkout} onClose={() => setCheckout(null)} />
    </div>
  );
}

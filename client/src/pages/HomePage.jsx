import { Link } from 'react-router-dom';
import { DemoReportPreview } from '../components/DemoReport';
import { FAQ } from '../components/FAQ';
import { Pricing } from '../components/Pricing';
import { Reveal } from '../components/Reveal';
import { AiDisclaimer } from '../components/AiDisclaimer';
import { COMPARISON, TESTIMONIALS, TRUST_STATS } from '../data/content';

const STEPS = [
  { num: '1', title: 'העלה סרטון', desc: 'גרור רילס עד דקה — MP4, MOV או WebM. הסרטון לא נשמר בשרת', icon: '📤' },
  { num: '2', title: 'ספר מה קורה בו', desc: 'פלטפורמה, מטרה, קהל — וחובה: מה נאמר/כתוב בסרטון (עם שניות)', icon: '📝' },
  { num: '3', title: 'קבל דוח מלא', desc: 'ציונים, ממצאים עם ראיה, תיקונים, hook ותסריט — הכל בעברית', icon: '📊' },
];

const AUDIENCE = [
  { icon: '🎬', title: 'יוצרי תוכן', desc: 'לדעת למה רילס לא תפס לפני שמעלים את הבא' },
  { icon: '🏪', title: 'עסקים קטנים', desc: 'מסעדות, חנויות, נותני שירות — בלי סוכנות' },
  { icon: '📱', title: 'סוכנויות סושיאל', desc: 'דוח מקצועי לשלוח ללקוח בלחיצה' },
];

export default function HomePage() {
  return (
    <div className="landing">
      <section className="hero">
        <div className="hero__glow" />
        <div className="hero__grid" />
        <div className="hero__content">
          <span className="hero__pill">
            <span className="hero__pill-dot" />
            ניתוח ראשון חינם · בלי כרטיס אשראי
          </span>
          <h1>
            גלה למה הרילס שלך
            <br />
            <span className="hero__gradient">לא תפס</span>
            {' '}— ומה לשנות
          </h1>
          <p className="hero__sub">
            העלה סרטון וקבל <strong>משוב AI</strong> (OpenAI): 6 ציונים, ממצאים עם ראיה,
            תוכנית שיפור ותסריט — מבוסס פריימים, אודיו ו-Vision. לא הבטחת ויראליות.
          </p>
          <div className="hero__actions">
            <Link to="/analyze" className="btn-hero">
              נתח סרטון בחינם
              <span>←</span>
            </Link>
            <a href="#demo" className="btn-hero-ghost">ראה דוגמת דוח</a>
          </div>
          <div className="hero__social">
            <span className="hero__stars" aria-hidden="true">★★★★★</span>
            <span>משוב AI ליוצרי תוכן · דוגמאות למטה</span>
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
            <p>3 צעדים. בלי הרשמה. בלי להבין טכנולוגיה.</p>
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
            <Link to="/analyze" className="btn-hero btn-hero--sm">התחל עכשיו — זה חינם</Link>
          </div>
        </div>
      </section>

      <section className="compare">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">למה זה שווה</span>
            <h2>מניחוש — לכיוון ממוקד</h2>
            <p>ההבדל בין להעלות בתקווה לבין לקבל משוב AI מסודר לפני/אחרי העלאה</p>
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
        </div>
      </section>

      <Pricing />
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
          <p>העלה סרטון וקבל משוב AI — הניתוח הראשון חינם · לא הבטחת תוצאות</p>
          <Link to="/analyze" className="btn-hero">
            נתח את הסרטון שלי
            <span>←</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

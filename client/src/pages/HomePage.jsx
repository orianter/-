import { Link } from 'react-router-dom';
import { DemoReportPreview } from '../components/DemoReport';
import { FAQ } from '../components/FAQ';
import { Pricing } from '../components/Pricing';

const STEPS = [
  { num: '1', title: 'העלה סרטון', desc: 'גרור רילס או טיקטוק עד דקה — MP4, MOV או WebM', icon: '📤' },
  { num: '2', title: 'ספר לנו קצת', desc: 'בחר פלטפורמה, מטרה, ומה לא עבד (אופציונלי)', icon: '📝' },
  { num: '3', title: 'קבל דוח', desc: 'תוך דקה — ציונים, תיקונים, hook ותסריט משופר', icon: '📊' },
];

const STATS = [
  { value: '6', label: 'מדדי ניתוח' },
  { value: '60s', label: 'מקסימום לסרטון' },
  { value: '~45s', label: 'זמן ניתוח ממוצע' },
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
        <div className="hero__content">
          <span className="hero__pill">AI לניתוח TikTok & Reels</span>
          <h1>
            גלה למה הרילס שלך
            <br />
            <span className="hero__gradient">לא תפס</span>
            {' '}— ומה לשנות
          </h1>
          <p className="hero__sub">
            העלה סרטון של עד דקה וקבל דוח מקצועי בעברית: ציונים, 3 תיקונים דחופים,
            hook חלופי ותסריט משופר. בלי ניחושים.
          </p>
          <div className="hero__actions">
            <Link to="/analyze" className="btn-hero">
              נתח סרטון בחינם
              <span>←</span>
            </Link>
            <a href="#demo" className="btn-hero-ghost">ראה דוגמת דוח</a>
          </div>
          <div className="hero__stats">
            {STATS.map((s) => (
              <div key={s.label} className="hero__stat">
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="audience">
        <div className="section-wrap">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="audience-card">
              <span className="audience-card__icon">{a.icon}</span>
              <h3>{a.title}</h3>
              <p>{a.desc}</p>
            </div>
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
            {STEPS.map((step) => (
              <div key={step.num} className="how-step">
                <div className="how-step__icon">{step.icon}</div>
                <span className="how-step__num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="how__cta">
            <Link to="/analyze" className="btn-hero btn-hero--sm">התחל עכשיו — זה חינם</Link>
          </div>
        </div>
      </section>

      <section id="demo" className="demo">
        <div className="section-wrap">
          <div className="section-head">
            <span className="section-tag">דוגמה אמיתית</span>
            <h2>ככה נראה הדוח</h2>
            <p>כך ייראה הניתוח שלך אחרי העלאת סרטון</p>
          </div>
          <DemoReportPreview />
        </div>
      </section>

      <Pricing />
      <FAQ />

      <section className="final-cta">
        <div className="final-cta__box">
          <h2>מוכן לשפר את הרילס הבא?</h2>
          <p>העלה סרטון וקבל משוב תוך פחות מדקה</p>
          <Link to="/analyze" className="btn-hero">
            נתח את הסרטון שלי
            <span>←</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

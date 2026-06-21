const CATEGORY_ORDER = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

const CATEGORY_ICONS = {
  hook: '⚡',
  pacing: '⏱️',
  message: '💬',
  visual: '🎨',
  audio: '🎧',
  platformFit: '📱',
};

export function scoreColor(score) {
  if (score >= 8) return 'var(--success)';
  if (score >= 5) return 'var(--warning)';
  return 'var(--accent)';
}

export function scoreVerdictLabel(score) {
  if (score >= 9) return 'מצוין';
  if (score >= 7) return 'טוב — עם מקום לשיפור';
  if (score >= 5) return 'בינוני — צריך עבודה';
  return 'דורש שיפור משמעותי';
}

export function ScoreRing({ score, size = 'lg' }) {
  const pct = (score / 10) * 100;
  const color = scoreColor(score);

  return (
    <div
      className={`score-ring score-ring--${size}`}
      style={{ '--pct': pct, '--color': color }}
      role="img"
      aria-label={`ציון AI משוער: ${score} מתוך 10`}
    >
      <div className="score-ring__glow" aria-hidden />
      <div className="score-ring__inner">
        <span className="score-ring__value">{score}</span>
        <span className="score-ring__label">/ 10</span>
      </div>
    </div>
  );
}

export function ReportDataSources({ sources }) {
  if (!sources) return null;

  const chips = [
    sources.frameCount > 0 && { icon: '🎞️', text: `${sources.frameCount} פריימים נדגמו` },
    sources.visionFrames > 0 && { icon: '👁️', text: `${sources.visionFrames} פריימי Vision` },
    sources.audioAnalyzed && { icon: '🎧', text: 'ניתוח אודיו' },
    sources.hasContentBrief && { icon: '📝', text: 'תוכן מהיוצר' },
  ].filter(Boolean);

  if (!chips.length) return null;

  return (
    <div className="report-sources">
      <span className="report-sources__label">מבוסס על</span>
      <div className="report-sources__chips">
        {chips.map((chip) => (
          <span key={chip.text} className="report-sources__chip">
            <span>{chip.icon}</span>
            {chip.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ImprovementPlan({ priorityFixes, whatToChange, howToImprove }) {
  const steps = [
    ...(priorityFixes || []).slice(0, 4).map((text, i) => ({
      num: i + 1,
      title: 'תיקון דחוף',
      text,
      type: 'urgent',
    })),
    ...(whatToChange || []).slice(0, 3).map((text, i) => ({
      num: (priorityFixes?.length || 0) + i + 1,
      title: 'מה לשנות',
      text,
      type: 'change',
    })),
    ...(howToImprove || []).slice(0, 3).map((text, i) => ({
      num: (priorityFixes?.length || 0) + (whatToChange?.length || 0) + i + 1,
      title: 'איך לשפר',
      text,
      type: 'grow',
    })),
  ].slice(0, 9);

  if (!steps.length) return null;

  return (
    <section className="improvement-plan">
      <div className="improvement-plan__head">
        <h3>תוכנית שיפור — מה לעשות עכשיו</h3>
        <p>ממוין לפי השפעה — התחל מלמעלה</p>
      </div>
      <div className="improvement-plan__grid">
        {steps.map((step) => (
          <article key={`${step.type}-${step.num}`} className={`improvement-plan__card improvement-plan__card--${step.type}`}>
            <span className="improvement-plan__step">{step.num}</span>
            <span className="improvement-plan__type">{step.title}</span>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CategoryScores({ categories }) {
  if (!categories) return null;

  const items = CATEGORY_ORDER.map((key) => ({ key, ...categories[key] })).filter((c) => c.label);

  return (
    <section className="category-scores">
      <div className="category-scores__head">
        <h3>ציון לפי קטגוריה</h3>
        <p>כל קטגוריה עם הסבר ספציפי לסרטון שלך</p>
      </div>
      <div className="category-scores__grid">
        {items.map((cat) => (
          <div key={cat.key} className="category-item">
            <div className="category-item__top">
              <span className="category-item__icon">{CATEGORY_ICONS[cat.key]}</span>
              <div className="category-item__header">
                <span className="category-item__label">{cat.label}</span>
                <span className="category-item__score" style={{ color: scoreColor(cat.score) }}>
                  {cat.score}/10
                </span>
              </div>
            </div>
            <div className="category-item__bar">
              <div
                className="category-item__fill"
                style={{ width: `${cat.score * 10}%`, background: scoreColor(cat.score) }}
              />
            </div>
            <p className="category-item__note">{cat.note}</p>
            {cat.detail && (cat.detail.whatWeSaw || cat.detail.exactFix) && (
              <div className="category-item__detail">
                {cat.detail.whatWeSaw && (
                  <p><strong>מה נמדד:</strong> {cat.detail.whatWeSaw}</p>
                )}
                {cat.detail.whyItMatters && (
                  <p><strong>למה זה משנה:</strong> {cat.detail.whyItMatters}</p>
                )}
                {cat.detail.exactFix && (
                  <p className="category-item__fix"><strong>תיקון מדויק:</strong> {cat.detail.exactFix}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function MeasuredEvidence({ items }) {
  if (!items?.length) return null;

  const sourceLabels = {
    frames: 'פריימים',
    audio: 'אודיו',
    content: 'תוכן',
    digest: 'מדידה',
    metadata: 'מטא',
  };

  return (
    <section className="measured-evidence">
      <div className="measured-evidence__head">
        <h3>נתונים שנמדדו מהסרטון</h3>
        <p>מספרים אמיתיים מהקובץ — לא הערכות AI</p>
      </div>
      <div className="measured-evidence__grid">
        {items.map((item, i) => (
          <article key={`${item.label}-${i}`} className="measured-evidence__card">
            <span className="measured-evidence__source">{sourceLabels[item.source] || item.source}</span>
            <h4>{item.label}</h4>
            <p className="measured-evidence__value">{item.value}</p>
            {item.implication && <p className="measured-evidence__impact">{item.implication}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export function DetailedFindings({ items }) {
  if (!items?.length) return null;

  return (
    <section className="detailed-findings">
      <div className="detailed-findings__head">
        <h3>ניתוח מפורט — ממצא + ראיה + תיקון</h3>
        <p>כל שורה מסבירה בדיוק מה הבעיה, על מה היא מבוססת, ומה לעשות</p>
      </div>
      <div className="detailed-findings__list">
        {items.map((item, i) => (
          <article key={`${item.area}-${i}`} className="detailed-findings__item">
            <div className="detailed-findings__top">
              <span className="detailed-findings__area">{item.area}</span>
              <span className="detailed-findings__num">{i + 1}</span>
            </div>
            <p className="detailed-findings__finding">{item.finding}</p>
            {item.evidence && (
              <p className="detailed-findings__evidence"><strong>ראיה:</strong> {item.evidence}</p>
            )}
            {item.impact && (
              <p className="detailed-findings__impact"><strong>השפעה:</strong> {item.impact}</p>
            )}
            {item.fix && (
              <p className="detailed-findings__fix"><strong>תיקון:</strong> {item.fix}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function AnalysisSection({ title, items, variant, icon, subtitle }) {
  if (!items?.length) return null;
  return (
    <section className={`report-section report-section--${variant}`}>
      <div className="report-section__head">
        <h3>{icon && <span className="section-icon">{icon}</span>}{title}</h3>
        {subtitle && <p className="report-section__sub">{subtitle}</p>}
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function PriorityFixes({ items }) {
  if (!items?.length) return null;
  return (
    <section className="priority-fixes">
      <div className="priority-fixes__head">
        <h3>התיקונים הכי דחופים</h3>
        <p>עשה את אלה קודם — הכי הרבה השפעה על הביצועים</p>
      </div>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            <span className="priority-fixes__num">{i + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Timeline({ items }) {
  if (!items?.length) return null;
  return (
    <section className="timeline">
      <div className="timeline__head">
        <h3>ציר זמן — רגעים קריטיים</h3>
        <p>מה לבדוק ולשנות בכל נקודה בסרטון</p>
      </div>
      <div className="timeline__track">
        {items.map((item, i) => (
          <div key={i} className="timeline__item">
            <div className="timeline__dot" />
            <div className="timeline__content">
              <span className="timeline__sec">{item.second}s</span>
              <p>{item.note}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function buildReportText({ result, platformLabel }) {
  const { analysis, durationSec } = result;
  const lines = [
    `Reel Analyzer — דוח ניתוח`,
    `${platformLabel} · ${durationSec} שניות`,
    `ציון כללי: ${analysis.score}/10`,
    analysis.verdict ? `פסק דין: ${analysis.verdict}` : '',
    '',
    analysis.summary,
    '',
  ];

  if (analysis.priorityFixes?.length) {
    lines.push('תיקונים דחופים:');
    analysis.priorityFixes.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    lines.push('');
  }

  if (analysis.detailedFindings?.length) {
    lines.push('ניתוח מפורט:');
    analysis.detailedFindings.forEach((item, i) => {
      lines.push(`${i + 1}. [${item.area}] ${item.finding}`);
      if (item.evidence) lines.push(`   ראיה: ${item.evidence}`);
      if (item.fix) lines.push(`   תיקון: ${item.fix}`);
    });
    lines.push('');
  }

  const sections = [
    ['למה לא עבד', analysis.whyItFailed],
    ['מה לשנות', analysis.whatToChange],
    ['איך לשפר', analysis.howToImprove],
    ['טיפים לפלטפורמה', analysis.platformTips],
  ];

  for (const [title, items] of sections) {
    if (items?.length) {
      lines.push(`${title}:`);
      items.forEach((item) => lines.push(`• ${item}`));
      lines.push('');
    }
  }

  if (analysis.hookSuggestion) {
    lines.push(`Hook מוצע: ${analysis.hookSuggestion}`, '');
  }
  if (analysis.scriptSuggestion) {
    lines.push(`תסריט משופר:\n${analysis.scriptSuggestion}`);
  }

  return lines.filter((l) => l !== '').join('\n');
}

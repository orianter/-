const CATEGORY_ORDER = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

const CATEGORY_ICONS = {
  hook: '⚡',
  pacing: '⏱️',
  message: '💬',
  visual: '🎨',
  audio: '🎧',
  platformFit: '📱',
};

const CATEGORY_NAMES = {
  hook: 'פתיחה',
  pacing: 'קצב',
  message: 'מסר',
  visual: 'ויזואל',
  audio: 'אודיו',
  platformFit: 'התאמה לפלטפורמה',
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
      aria-label={`ציון משוער: ${score} מתוך 10`}
    >
      <div className="score-ring__glow" aria-hidden />
      <div className="score-ring__inner">
        <span className="score-ring__value">{score}</span>
        <span className="score-ring__label">/ 10</span>
      </div>
    </div>
  );
}

export function ReportDataSources() {
  return null;
}

export function ReportCostEstimate() {
  return null;
}

/** Teaser preview banner */
export function ReportTeaserBanner({ onUnlock }) {
  return (
    <div className="report-teaser-banner" role="status">
      <span className="report-teaser-banner__tag">תצוגה מקדימה</span>
      <h3 className="report-teaser-banner__title">ראית את הציון — הדוח המלא נעול</h3>
      <p className="report-teaser-banner__desc">
        תיקונים, תסריט, ציונים לכל הנושאים, תמלול וציר זמן — בדוח המלא אחרי בחירת מסלול.
      </p>
      <button type="button" className="btn-hero btn-hero--sm" onClick={onUnlock}>
        פתח את הדוח המלא ←
      </button>
    </div>
  );
}

/** Locked section overlay for teaser mode */
export function ReportLockedBlock({ title, subtitle, items = 3, onUnlock, children }) {
  return (
    <div className="report-locked">
      <div className="report-locked__content" aria-hidden="true">
        {children || (
          <ul className="report-locked__fake-list">
            {Array.from({ length: items }, (_, i) => (
              <li key={i}>████████ ████████ ██████</li>
            ))}
          </ul>
        )}
      </div>
      <div className="report-locked__overlay">
        <span className="report-locked__icon" aria-hidden="true">🔒</span>
        <strong>{title}</strong>
        {subtitle && <p>{subtitle}</p>}
        <button type="button" className="btn-hero btn-hero--sm" onClick={onUnlock}>
          פתח בדוח המלא ←
        </button>
      </div>
    </div>
  );
}

/** Top 3 actions — clearest entry point in the report */
export function ReportQuickStart({ priorityFixes }) {
  const items = (priorityFixes || []).slice(0, 3);
  if (!items.length) return null;

  return (
    <section className="report-quick-start" aria-labelledby="report-quick-start-heading">
      <div className="report-quick-start__head">
        <h3 id="report-quick-start-heading">התחל כאן — 3 דברים לשפר</h3>
        <p>עשה את אלה בסרטון הבא, לפי הסדר. זה מה שישפיע הכי הרבה.</p>
      </div>
      <ol className="report-quick-start__list">
        {items.map((text, i) => (
          <li key={i} className="report-quick-start__item">
            <span className="report-quick-start__num" aria-hidden="true">{i + 1}</span>
            <span className="report-quick-start__text">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Weak category chips — at-a-glance */
export function ReportWeakAreas({ categories }) {
  if (!categories) return null;
  const weak = CATEGORY_ORDER
    .map((key) => ({ key, ...categories[key] }))
    .filter((c) => c.label && typeof c.score === 'number' && c.score <= 6)
    .sort((a, b) => a.score - b.score);

  if (!weak.length) return null;

  return (
    <section className="report-weak-areas" aria-labelledby="report-weak-heading">
      <h3 id="report-weak-heading" className="report-weak-areas__title">איפה הכי חלש</h3>
      <ul className="report-weak-areas__list">
        {weak.map((cat) => (
          <li key={cat.key} className="report-weak-areas__chip">
            <span className="report-weak-areas__label">{cat.label || CATEGORY_NAMES[cat.key]}</span>
            <span className="report-weak-areas__score" style={{ color: scoreColor(cat.score) }}>
              {cat.score}/10
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Extra tips after the top 3 — no duplicate urgent fixes */
export function ReportExtraTips({ whatToChange, howToImprove }) {
  const tips = [
    ...(whatToChange || []).slice(0, 2).map((text) => ({ text, type: 'change', label: 'לשנות' })),
    ...(howToImprove || []).slice(0, 2).map((text) => ({ text, type: 'grow', label: 'לשפר' })),
  ].slice(0, 4);

  if (!tips.length) return null;

  return (
    <section className="report-extra-tips" aria-labelledby="report-extra-heading">
      <h3 id="report-extra-heading">עוד רעיונות לשיפור</h3>
      <ul className="report-extra-tips__list">
        {tips.map((tip, i) => (
          <li key={i} className={`report-extra-tips__item report-extra-tips__item--${tip.type}`}>
            <span className="report-extra-tips__tag">{tip.label}</span>
            {tip.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportDeepDive({ children, title = 'פרטים נוספים בדוח' }) {
  return (
    <details className="report-deep-dive">
      <summary className="report-deep-dive__summary">{title}</summary>
      <div className="report-deep-dive__body">{children}</div>
    </details>
  );
}

/** @deprecated use ReportQuickStart + ReportExtraTips */
export function ImprovementPlan({ priorityFixes, whatToChange, howToImprove }) {
  return (
    <>
      <ReportQuickStart priorityFixes={priorityFixes} />
      <ReportExtraTips whatToChange={whatToChange} howToImprove={howToImprove} />
    </>
  );
}

export function CategoryScores({ categories, teaserMode = false }) {
  if (!categories) return null;

  if (teaserMode) {
    const hook = categories.hook;
    const lockedKeys = CATEGORY_ORDER.filter((key) => key !== 'hook');

    return (
      <section className="category-scores category-scores--teaser" aria-labelledby="category-scores-heading">
        <div className="category-scores__head">
          <h3 id="category-scores-heading">ציונים לפי נושא</h3>
          <p>פתיחה בלבד בתצוגה המקדימה — שאר הנושאים בדוח המלא</p>
        </div>
        {hook?.label && (
          <div className="category-scores__grid category-scores__grid--single">
            <div className={`category-item${hook.score <= 6 ? ' category-item--weak' : ''}`}>
              <div className="category-item__top">
                <span className="category-item__icon" aria-hidden="true">{CATEGORY_ICONS.hook}</span>
                <div className="category-item__header">
                  <span className="category-item__label">{hook.label}</span>
                  <span className="category-item__score" style={{ color: scoreColor(hook.score) }}>
                    {hook.score}/10
                  </span>
                </div>
              </div>
              <div className="category-item__bar">
                <div
                  className="category-item__fill"
                  style={{ width: `${hook.score * 10}%`, background: scoreColor(hook.score) }}
                />
              </div>
              <p className="category-item__note">{hook.note}</p>
            </div>
          </div>
        )}
        <div className="category-scores__locked-row">
          {lockedKeys.map((key) => (
            <div key={key} className="category-item category-item--locked">
              <span className="category-item__icon" aria-hidden="true">{CATEGORY_ICONS[key]}</span>
              <span className="category-item__label">{CATEGORY_NAMES[key]}</span>
              <span className="category-item__lock">🔒</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const items = CATEGORY_ORDER
    .map((key) => ({ key, ...categories[key] }))
    .filter((c) => c.label)
    .sort((a, b) => a.score - b.score);

  return (
    <section className="category-scores" aria-labelledby="category-scores-heading">
      <div className="category-scores__head">
        <h3 id="category-scores-heading">ציונים לפי נושא</h3>
        <p>מסודר מהחלש לחזק — התמקד בקטגוריות עם ציון נמוך</p>
      </div>
      <div className="category-scores__grid">
        {items.map((cat) => (
          <div
            key={cat.key}
            className={`category-item${cat.score <= 6 ? ' category-item--weak' : ''}`}
          >
            <div className="category-item__top">
              <span className="category-item__icon" aria-hidden="true">{CATEGORY_ICONS[cat.key]}</span>
              <span className="visually-hidden">{CATEGORY_NAMES[cat.key]}</span>
              {cat.score <= 6 && <span className="category-item__weak-badge">דורש שיפור</span>}
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
    frames: 'ויזואל',
    visual: 'ויזואל',
    audio: 'אודיו',
    content: 'תוכן',
    digest: 'מדידה',
    metadata: 'פרטי סרטון',
  };

  return (
    <section className="measured-evidence">
      <div className="measured-evidence__head">
        <h3>נתונים שנמדדו מהסרטון</h3>
        <p>מספרים מהסרטון — לא הערכות כלליות</p>
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

export function OnScreenText({ items }) {
  if (!items?.length) return null;
  return (
    <section className="report-section report-section--onscreen">
      <div className="report-section__head">
        <h3>טקסט על המסך</h3>
        <p>מה שזוהה על המסך — בדוק גודל, מיקום וקריאות</p>
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function SpeechMetricsSummary({ metrics }) {
  if (!metrics?.hasSpeech) return null;
  return (
    <p className="report-speech-metrics">
      דיבור: {metrics.wordCount} מילים · {metrics.wpm} מילים/דקה
      {metrics.hookHasSpeech ? ` · דיבור בפתיחה מ-${metrics.hookSpeechSec}s` : ' · אין דיבור בפתיחה'}
      {metrics.ctaAtSec != null ? ` · CTA ב-${metrics.ctaAtSec}s` : ' · CTA לא זוהה'}
    </p>
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

/** @deprecated use ReportQuickStart */
export function PriorityFixes({ items }) {
  return <ReportQuickStart priorityFixes={items} />;
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

  if (result.speechMetrics?.hasSpeech) {
    const sm = result.speechMetrics;
    lines.push(`דיבור: ${sm.wordCount} מילים · ${sm.wpm} מילים/דקה · CTA: ${sm.ctaAtSec ?? 'לא'}`, '');
  }

  if (analysis.onScreenText?.length) {
    lines.push('טקסט על המסך:');
    analysis.onScreenText.forEach((t) => lines.push(`• ${t}`));
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
    lines.push(`פתיחה מוצעת: ${analysis.hookSuggestion}`, '');
  }
  if (analysis.scriptSuggestion) {
    lines.push(`תסריט משופר:\n${analysis.scriptSuggestion}`);
  }

  return lines.filter((l) => l !== '').join('\n');
}

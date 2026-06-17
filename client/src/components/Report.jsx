const CATEGORY_ORDER = ['hook', 'pacing', 'message', 'visual', 'audio', 'platformFit'];

export function scoreColor(score) {
  if (score >= 8) return 'var(--success)';
  if (score >= 5) return 'var(--warning)';
  return 'var(--accent)';
}

export function ScoreRing({ score, size = 'lg' }) {
  const pct = (score / 10) * 100;
  const color = scoreColor(score);

  return (
    <div className={`score-ring score-ring--${size}`} style={{ '--pct': pct, '--color': color }}>
      <div className="score-ring__inner">
        <span className="score-ring__value">{score}</span>
        <span className="score-ring__label">/ 10</span>
      </div>
    </div>
  );
}

export function CategoryScores({ categories }) {
  if (!categories) return null;

  const items = CATEGORY_ORDER.map((key) => categories[key]).filter(Boolean);

  return (
    <section className="category-scores">
      <h3>ציון לפי קטגוריה</h3>
      <div className="category-scores__grid">
        {items.map((cat) => (
          <div key={cat.label} className="category-item">
            <div className="category-item__header">
              <span className="category-item__label">{cat.label}</span>
              <span className="category-item__score" style={{ color: scoreColor(cat.score) }}>
                {cat.score}/10
              </span>
            </div>
            <div className="category-item__bar">
              <div
                className="category-item__fill"
                style={{ width: `${cat.score * 10}%`, background: scoreColor(cat.score) }}
              />
            </div>
            <p className="category-item__note">{cat.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AnalysisSection({ title, items, variant, icon }) {
  if (!items?.length) return null;
  return (
    <section className={`report-section report-section--${variant}`}>
      <h3>{icon && <span className="section-icon">{icon}</span>}{title}</h3>
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
      <h3>3 התיקונים הכי דחופים</h3>
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
      <h3>ציר זמן — רגעים קריטיים</h3>
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

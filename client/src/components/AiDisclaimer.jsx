import { AI_DISCLAIMER } from '../data/content';

export function AiDisclaimer({ variant = 'default', className = '' }) {
  const text = variant === 'short' ? AI_DISCLAIMER.short : AI_DISCLAIMER.full;

  return (
    <aside
      className={`ai-disclaimer ai-disclaimer--${variant} ${className}`.trim()}
      role="note"
      aria-label="הבהרה חשובה"
    >
      <span className="ai-disclaimer__icon" aria-hidden="true">ℹ️</span>
      <div className="ai-disclaimer__body">
        {variant !== 'short' && <strong>חשוב לדעת — זו המלצה, לא הבטחה</strong>}
        <p>{text}</p>
        {variant === 'default' && (
          <ul className="ai-disclaimer__list">
            {AI_DISCLAIMER.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

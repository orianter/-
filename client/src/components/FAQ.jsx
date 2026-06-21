import { useId, useState } from 'react';
import { FAQ_ITEMS } from '../data/content';

export function FAQ() {
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <section id="faq" className="faq" aria-labelledby="faq-heading">
      <div className="section-wrap section-wrap--narrow">
        <div className="section-head">
          <span className="section-tag">שאלות נפוצות</span>
          <h2 id="faq-heading">יש שאלות?</h2>
        </div>
        <div className="faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const panelId = `${baseId}-panel-${i}`;
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                className={`faq-item ${isOpen ? 'faq-item--open' : ''}`}
              >
                <button
                  type="button"
                  className="faq-item__q"
                  id={`${baseId}-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span>{item.q}</span>
                  <span className="faq-item__icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={`${baseId}-btn-${i}`}
                  hidden={!isOpen}
                  className="faq-item__panel"
                >
                  <p className="faq-item__a">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

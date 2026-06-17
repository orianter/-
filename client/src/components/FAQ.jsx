import { useState } from 'react';
import { FAQ_ITEMS } from '../data/content';

export function FAQ() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="faq">
      <div className="section-wrap section-wrap--narrow">
        <div className="section-head">
          <span className="section-tag">שאלות נפוצות</span>
          <h2>יש שאלות?</h2>
        </div>
        <div className="faq__list">
          {FAQ_ITEMS.map((item, i) => (
            <div
              key={item.q}
              className={`faq-item ${open === i ? 'faq-item--open' : ''}`}
            >
              <button
                type="button"
                className="faq-item__q"
                onClick={() => setOpen(open === i ? -1 : i)}
              >
                <span>{item.q}</span>
                <span className="faq-item__icon">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <p className="faq-item__a">{item.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

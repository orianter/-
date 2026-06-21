import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export function Navbar() {
  const { pathname } = useLocation();
  const onAnalyze = pathname === '/analyze';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-open', menuOpen);
    return () => document.body.classList.remove('nav-open');
  }, [menuOpen]);

  const navLinks = !onAnalyze && (
    <>
      <a href="/#how" onClick={() => setMenuOpen(false)}>איך זה עובד</a>
      <a href="/#pricing" onClick={() => setMenuOpen(false)}>מחירים</a>
      <a href="/#faq" onClick={() => setMenuOpen(false)}>שאלות</a>
    </>
  );

  return (
    <nav className="navbar" aria-label="ניווט ראשי">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" aria-label="Reel Analyzer — דף הבית">
          <span className="navbar__logo" aria-hidden="true">▶</span>
          <span>Reel Analyzer</span>
        </Link>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={menuOpen}
          aria-controls="navbar-menu"
          aria-label={menuOpen ? 'סגור תפריט' : 'פתח תפריט'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="navbar__toggle-bar" aria-hidden="true" />
          <span className="navbar__toggle-bar" aria-hidden="true" />
          <span className="navbar__toggle-bar" aria-hidden="true" />
        </button>

        <div
          id="navbar-menu"
          className={`navbar__links ${menuOpen ? 'navbar__links--open' : ''}`}
        >
          {navLinks}
          <Link
            to="/analyze"
            className="navbar__cta"
            onClick={() => setMenuOpen(false)}
          >
            {onAnalyze ? '← חזרה לדף הבית' : 'נתח סרטון'}
          </Link>
        </div>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="navbar__backdrop"
          aria-label="סגור תפריט"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="navbar__logo" aria-hidden="true">▶</span>
          <strong>Reel Analyzer</strong>
          <p>משוב לסרטוני TikTok ו-Reels — לא הבטחת תוצאות</p>
        </div>
        <div className="site-footer__cols">
          <div>
            <h4>מוצר</h4>
            <a href="/#how">איך זה עובד</a>
            <Link to="/analyze">נתח סרטון</Link>
            <a href="/#pricing">מחירים</a>
          </div>
          <div>
            <h4>מידע</h4>
            <a href="/#faq">שאלות נפוצות</a>
            <a href="/#ai-disclaimer">הבהרה חשובה</a>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Reel Analyzer · הסרטון לא נשמר · הדוח הוא המלצה — לא הבטחת תוצאות</p>
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div className="layout">
      <a href="#main-content" className="skip-link">
        דלג לתוכן הראשי
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

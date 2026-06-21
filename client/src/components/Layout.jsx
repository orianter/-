import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export function Navbar() {
  const { pathname } = useLocation();
  const onAnalyze = pathname === '/analyze';

  return (
    <nav className="navbar" aria-label="ניווט ראשי">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand" aria-label="Reel Analyzer — דף הבית">
          <span className="navbar__logo" aria-hidden="true">▶</span>
          <span>Reel Analyzer</span>
        </Link>

        <div className="navbar__links">
          {!onAnalyze && (
            <>
              <a href="/#how">איך זה עובד</a>
              <a href="/#pricing">מחירים</a>
              <a href="/#faq">שאלות</a>
            </>
          )}
          <Link to="/analyze" className="navbar__cta">
            {onAnalyze ? '← חזרה לדף הבית' : 'נתח סרטון'}
          </Link>
        </div>
      </div>
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
          <p>משוב AI לסרטוני TikTok ו-Reels — לא הבטחת תוצאות</p>
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
            <a href="/#ai-disclaimer">הבהרה על AI</a>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Reel Analyzer · הסרטון לא נשמר · הדוח הוא המלצת AI (OpenAI)</p>
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

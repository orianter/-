import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

export function Navbar() {
  const { pathname } = useLocation();
  const onAnalyze = pathname === '/analyze';

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">
          <span className="navbar__logo">▶</span>
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
          <span className="navbar__logo">▶</span>
          <strong>Reel Analyzer</strong>
          <p>ניתוח AI לסרטוני TikTok ו-Reels</p>
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
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Reel Analyzer · הסרטון נמחק אחרי כל ניתוח</p>
      </div>
    </footer>
  );
}

export function Layout({ children }) {
  return (
    <div className="layout">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

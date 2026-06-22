import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import AnalyzePage from './pages/AnalyzePage';
import HomePage from './pages/HomePage';
import './styles/global.css';
import './styles/landing.css';
import './styles/analyze.css';
import './styles/report.css';
import './styles/report-teaser.css';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/analyze" element={<AnalyzePage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

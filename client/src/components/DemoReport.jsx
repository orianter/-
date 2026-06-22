import {
  AnalysisSection,
  CategoryScores,
  DetailedFindings,
  ReportExtraTips,
  ReportQuickStart,
  ReportWeakAreas,
  ScoreRing,
  Timeline,
} from './Report';
import { AiDisclaimer } from './AiDisclaimer';
import { MOCK_RESULT } from '../data/content';

export function DemoReportPreview() {
  const { analysis } = MOCK_RESULT;

  return (
    <div className="demo-report">
      <div className="demo-report__badge">דוגמה — לא הסרטון שלך</div>
      <AiDisclaimer variant="short" />
      <div className="demo-report__top">
        <ScoreRing score={analysis.score} />
        <div>
          <p className="demo-report__verdict">"{analysis.verdict}"</p>
          <p className="demo-report__summary">{analysis.summary}</p>
        </div>
      </div>
      <ReportQuickStart priorityFixes={analysis.priorityFixes} />
      <ReportWeakAreas categories={analysis.categories} />
      <CategoryScores categories={analysis.categories} />
      <ReportExtraTips whatToChange={analysis.whatToChange} howToImprove={analysis.howToImprove} />
      <DetailedFindings items={analysis.detailedFindings} />
      <Timeline items={analysis.timeline} />
      <div className="demo-report__sections">
        <AnalysisSection title="למה לא עבד" items={analysis.whyItFailed} variant="fail" icon="✕" subtitle="סיבות עם ראיה" />
      </div>
      {analysis.hookSuggestion && (
        <section className="report-section report-section--hook">
          <h3>פתיחה מוצעת</h3>
          <p className="hook-text">"{analysis.hookSuggestion}"</p>
        </section>
      )}
    </div>
  );
}

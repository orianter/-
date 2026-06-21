import {
  AnalysisSection,
  CategoryScores,
  DetailedFindings,
  ImprovementPlan,
  MeasuredEvidence,
  PriorityFixes,
  ScoreRing,
  Timeline,
} from './Report';
import { AiDisclaimer } from './AiDisclaimer';
import { MOCK_RESULT } from '../data/content';

export function DemoReportPreview() {
  const { analysis } = MOCK_RESULT;

  return (
    <div className="demo-report">
      <div className="demo-report__badge">דוגמה — לא הסרטון שלך · משוב AI</div>
      <AiDisclaimer variant="short" />
      <div className="demo-report__top">
        <ScoreRing score={analysis.score} />
        <div>
          <p className="demo-report__verdict">"{analysis.verdict}"</p>
          <p className="demo-report__summary">{analysis.summary}</p>
        </div>
      </div>
      <ImprovementPlan
        priorityFixes={analysis.priorityFixes}
        whatToChange={analysis.whatToChange}
        howToImprove={analysis.howToImprove}
      />
      <DetailedFindings items={analysis.detailedFindings} />
      <PriorityFixes items={analysis.priorityFixes} />
      <CategoryScores categories={analysis.categories} />
      <Timeline items={analysis.timeline} />
      <div className="demo-report__sections">
        <AnalysisSection title="למה לא עבד" items={analysis.whyItFailed} variant="fail" icon="✕" subtitle="סיבות עם ראיה" />
        <AnalysisSection title="מה לשנות" items={analysis.whatToChange} variant="change" icon="✎" subtitle="שינויים קונקרטיים" />
      </div>
      {analysis.hookSuggestion && (
        <section className="report-section report-section--hook">
          <h3>פתיחה מוצעת (Hook)</h3>
          <p className="hook-text">"{analysis.hookSuggestion}"</p>
        </section>
      )}
    </div>
  );
}

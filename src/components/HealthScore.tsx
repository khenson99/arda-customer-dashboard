import { memo } from 'react';

interface HealthScoreProps {
  score: number;
}

/**
 * Health score visualization component with bar and value display.
 * Uses CSS-based rendering for performance.
 */
export const HealthScore = memo(function HealthScore({ score }: HealthScoreProps) {
  const level = score >= 70 ? 'healthy' : score >= 40 ? 'at-risk' : 'critical';
  
  return (
    <div className="health-score">
      <div className="health-score-bar">
        <div
          className={`health-score-fill ${level}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="health-score-value">{score}</span>
    </div>
  );
});

export default HealthScore;

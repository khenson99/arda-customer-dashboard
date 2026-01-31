// @ts-nocheck
/**
 * SuccessPlan Component
 * 
 * A standalone success plan display component that can be embedded in various views.
 * Shows plan overview, progress, milestones, and goals.
 */

import { useState } from 'react';
import type { SuccessPlan as SuccessPlanType, Milestone, MilestoneStatus } from '../lib/types/account';
import { getNextMilestone, getOverdueMilestones } from '../lib/success-plans';

const calculatePlanProgress = (plan: SuccessPlanType) => plan.progress ?? 0;
const getBlockedMilestones = (plan: SuccessPlanType) =>
  plan.milestones.filter((m) => m.status === 'blocked');
const getDaysRemaining = (plan: SuccessPlanType) => {
  if (!plan.targetEndDate) return null;
  const target = new Date(plan.targetEndDate);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
const getPlanHealthStatus = (plan: SuccessPlanType) => {
  const overdue = getOverdueMilestones(plan);
  const blocked = getBlockedMilestones(plan);
  if (overdue.length >= 2 || blocked.length >= 2) return 'critical';
  if (overdue.length > 0 || blocked.length > 0) return 'at_risk';
  return 'healthy';
};
const statusIcons: Record<MilestoneStatus, string> = {
  completed: '✅',
  in_progress: '🔄',
  blocked: '🚫',
  skipped: '⏭️',
  pending: '⏳',
};
const statusColors: Record<MilestoneStatus, string> = {
  completed: 'var(--success)',
  in_progress: 'var(--info)',
  blocked: 'var(--danger)',
  skipped: 'var(--text-muted)',
  pending: 'var(--text-muted)',
};
const getMilestoneStatusIcon = (status: MilestoneStatus) => statusIcons[status] || '⏳';
const getMilestoneStatusColor = (status: MilestoneStatus) => statusColors[status] || 'var(--text-muted)';

// ============================================================================
// TYPES
// ============================================================================

interface SuccessPlanProps {
  plan: SuccessPlanType;
  onUpdatePlan?: (plan: SuccessPlanType) => void;
  compact?: boolean;
  showGoals?: boolean;
}

interface MilestoneCardProps {
  milestone: Milestone;
  index: number;
  onStatusChange?: (milestoneId: string, status: MilestoneStatus) => void;
  compact?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SuccessPlan({ plan, onUpdatePlan, compact = false, showGoals = true }: SuccessPlanProps) {
  const progress = calculatePlanProgress(plan);
  const nextMilestone = getNextMilestone(plan);
  const overdueMilestones = getOverdueMilestones(plan);
  const blockedMilestones = getBlockedMilestones(plan);
  const daysRemaining = getDaysRemaining(plan);
  const healthStatus = getPlanHealthStatus(plan);

  const handleMilestoneStatusChange = (milestoneId: string, newStatus: MilestoneStatus) => {
    if (!onUpdatePlan) return;

    const now = new Date().toISOString();
    const updatedPlan: SuccessPlanType = {
      ...plan,
      updatedAt: now,
      milestones: plan.milestones.map(m =>
        m.id === milestoneId
          ? {
              ...m,
              status: newStatus,
              completedDate: newStatus === 'completed' ? now : undefined,
            }
          : m
      ),
    };
    updatedPlan.progress = calculatePlanProgress(updatedPlan);
    onUpdatePlan(updatedPlan);
  };

  if (compact) {
    return (
      <CompactSuccessPlan
        progress={progress}
        nextMilestone={nextMilestone}
        daysRemaining={daysRemaining}
        healthStatus={healthStatus}
      />
    );
  }

  return (
    <div className="success-plan">
      {/* Plan Header */}
      <div className="success-plan-header">
        <div className="plan-progress-section">
          <div className="plan-progress-circle">
            <svg viewBox="0 0 36 36" className="progress-ring">
              <path
                className="progress-ring-bg"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3"
              />
              <path
                className="progress-ring-fill"
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeDasharray={`${progress}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="progress-value">{progress}%</span>
          </div>
          <div className="plan-progress-info">
            <span className="progress-label">Plan Progress</span>
            <span className="progress-detail">
              {plan.milestones.filter(m => m.status === 'completed').length} of {plan.milestones.length} milestones
            </span>
          </div>
        </div>

        <div className="plan-status-badges">
          <span className={`plan-health-badge ${healthStatus}`}>
            {healthStatus === 'healthy' ? '✓ On Track' : 
             healthStatus === 'at_risk' ? '⚠️ At Risk' : '🚨 Critical'}
          </span>
          {daysRemaining !== null && (
            <span className={`days-remaining-badge ${daysRemaining < 0 ? 'overdue' : daysRemaining < 14 ? 'urgent' : ''}`}>
              {daysRemaining < 0 
                ? `${Math.abs(daysRemaining)} days overdue`
                : `${daysRemaining} days remaining`}
            </span>
          )}
        </div>
      </div>

      {/* Alerts Section */}
      {(overdueMilestones.length > 0 || blockedMilestones.length > 0) && (
        <div className="plan-alerts">
          {overdueMilestones.map(m => (
            <div key={m.id} className="plan-alert overdue">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">
                <strong>{m.name}</strong> is overdue
                {m.targetDate && ` (due ${new Date(m.targetDate).toLocaleDateString()})`}
              </span>
            </div>
          ))}
          {blockedMilestones.map(m => (
            <div key={m.id} className="plan-alert blocked">
              <span className="alert-icon">🚫</span>
              <span className="alert-text">
                <strong>{m.name}</strong> is blocked
                {m.blockers && m.blockers.length > 0 && `: ${m.blockers[0]}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Next Milestone Highlight */}
      {nextMilestone && (
        <div className="next-milestone-card">
          <div className="next-milestone-label">Next Milestone</div>
          <div className="next-milestone-content">
            <span className="milestone-icon">{getMilestoneStatusIcon(nextMilestone.status)}</span>
            <div className="milestone-info">
              <span className="milestone-name">{nextMilestone.name}</span>
              {nextMilestone.targetDate && (
                <span className="milestone-target">
                  Target: {new Date(nextMilestone.targetDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Milestones List */}
      <div className="milestones-section">
        <h4>Milestones</h4>
        <div className="milestones-timeline">
          {[...plan.milestones]
            .sort((a, b) => a.order - b.order)
            .map((milestone, index) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                index={index}
                onStatusChange={onUpdatePlan ? handleMilestoneStatusChange : undefined}
              />
            ))}
        </div>
      </div>

      {/* Goals Section */}
      {showGoals && plan.goals.length > 0 && (
        <div className="goals-section">
          <h4>Success Goals</h4>
          <div className="goals-list">
            {plan.goals.map(goal => (
              <div key={goal.id} className={`goal-item status-${goal.status}`}>
                <span className="goal-status-icon">
                  {goal.status === 'achieved' ? '✅' :
                   goal.status === 'in_progress' ? '🔄' :
                   goal.status === 'at_risk' ? '⚠️' :
                   goal.status === 'missed' ? '❌' : '⏳'}
                </span>
                <div className="goal-content">
                  <span className="goal-description">{goal.description}</span>
                  {goal.targetMetric && goal.currentValue !== undefined && goal.targetValue !== undefined && (
                    <div className="goal-progress">
                      <div className="goal-progress-bar">
                        <div 
                          className="goal-progress-fill"
                          style={{ width: `${Math.min(100, (goal.currentValue / goal.targetValue) * 100)}%` }}
                        />
                      </div>
                      <span className="goal-progress-text">
                        {goal.currentValue} / {goal.targetValue}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CompactSuccessPlan({
  progress,
  nextMilestone,
  daysRemaining,
  healthStatus,
}: {
  progress: number;
  nextMilestone: Milestone | undefined;
  daysRemaining: number | null;
  healthStatus: 'healthy' | 'at_risk' | 'critical';
}) {
  return (
    <div className="success-plan-compact">
      <div className="compact-header">
        <div className="compact-progress">
          <div className="compact-progress-bar">
            <div className="compact-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="compact-progress-text">{progress}%</span>
        </div>
        <span className={`compact-health ${healthStatus}`}>
          {healthStatus === 'healthy' ? '✓' : healthStatus === 'at_risk' ? '⚠️' : '🚨'}
        </span>
      </div>
      
      {nextMilestone && (
        <div className="compact-next-milestone">
          <span className="compact-label">Next:</span>
          <span className="compact-milestone-name">{nextMilestone.name}</span>
        </div>
      )}
      
      {daysRemaining !== null && (
        <div className="compact-days">
          {daysRemaining < 0 
            ? `${Math.abs(daysRemaining)}d overdue`
            : `${daysRemaining}d remaining`}
        </div>
      )}
    </div>
  );
}

function MilestoneCard({ milestone, index, onStatusChange }: MilestoneCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isOverdue = milestone.targetDate && 
    milestone.status !== 'completed' && 
    milestone.status !== 'skipped' &&
    new Date(milestone.targetDate) < new Date();

  return (
    <div 
      className={`milestone-card status-${milestone.status} ${isOverdue ? 'overdue' : ''} ${isExpanded ? 'expanded' : ''}`}
    >
      <div 
        className="milestone-card-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="milestone-order-indicator">
          {milestone.status === 'completed' ? '✓' : index + 1}
        </div>
        <div className="milestone-connector" />
        
        <div className="milestone-card-content">
          <div className="milestone-title-row">
            <span 
              className="milestone-status-dot"
              style={{ backgroundColor: getMilestoneStatusColor(milestone.status) }}
            />
            <span className="milestone-name">{milestone.name}</span>
            <span className={`milestone-status-badge ${milestone.status}`}>
              {getMilestoneStatusIcon(milestone.status)}
            </span>
          </div>
          
          {milestone.targetDate && (
            <span className={`milestone-date ${isOverdue ? 'overdue' : ''}`}>
              {milestone.status === 'completed' && milestone.completedDate
                ? `Completed ${new Date(milestone.completedDate).toLocaleDateString()}`
                : `Target: ${new Date(milestone.targetDate).toLocaleDateString()}`}
            </span>
          )}
        </div>
        
        <button className="milestone-expand-toggle">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="milestone-card-expanded">
          {milestone.description && (
            <p className="milestone-description">{milestone.description}</p>
          )}
          
          {milestone.ownerName && (
            <div className="milestone-owner">
              <span className="owner-label">Owner:</span>
              <span className="owner-name">{milestone.ownerName}</span>
            </div>
          )}

          {milestone.blockers && milestone.blockers.length > 0 && (
            <div className="milestone-blockers">
              <span className="blockers-label">Blockers:</span>
              <ul className="blockers-list">
                {milestone.blockers.map((blocker, idx) => (
                  <li key={idx}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}

          {onStatusChange && (
            <div className="milestone-actions">
              <span className="actions-label">Update status:</span>
              <div className="status-buttons">
                {(['pending', 'in_progress', 'completed', 'blocked', 'skipped'] as MilestoneStatus[]).map(status => (
                  <button
                    key={status}
                    className={`status-btn ${milestone.status === status ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(milestone.id, status);
                    }}
                  >
                    {getMilestoneStatusIcon(status)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUMMARY WIDGET (for Overview tab)
// ============================================================================

interface SuccessPlanSummaryWidgetProps {
  plan: SuccessPlanType;
  onViewPlan: () => void;
}

export function SuccessPlanSummaryWidget({ plan, onViewPlan }: SuccessPlanSummaryWidgetProps) {
  const progress = calculatePlanProgress(plan);
  const nextMilestone = getNextMilestone(plan);
  const daysRemaining = getDaysRemaining(plan);
  const overdueMilestones = getOverdueMilestones(plan);
  const healthStatus = getPlanHealthStatus(plan);

  return (
    <div className="glass-card success-plan-widget">
      <div className="widget-header">
        <h3>🎯 Success Plan</h3>
        <span className={`plan-status-indicator ${healthStatus}`}>
          {healthStatus === 'healthy' ? 'On Track' : 
           healthStatus === 'at_risk' ? 'At Risk' : 'Critical'}
        </span>
      </div>

      <div className="widget-content">
        <div className="widget-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">{progress}% complete</span>
        </div>

        {nextMilestone && (
          <div className="widget-next-milestone">
            <span className="label">Next milestone:</span>
            <span className="milestone-name">{nextMilestone.name}</span>
            {nextMilestone.targetDate && (
              <span className="milestone-date">
                {new Date(nextMilestone.targetDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        <div className="widget-stats">
          {daysRemaining !== null && (
            <div className={`stat ${daysRemaining < 0 ? 'overdue' : ''}`}>
              <span className="stat-value">
                {daysRemaining < 0 ? Math.abs(daysRemaining) : daysRemaining}
              </span>
              <span className="stat-label">
                {daysRemaining < 0 ? 'days overdue' : 'days left'}
              </span>
            </div>
          )}
          <div className="stat">
            <span className="stat-value">{plan.milestones.filter(m => m.status === 'completed').length}</span>
            <span className="stat-label">completed</span>
          </div>
          {overdueMilestones.length > 0 && (
            <div className="stat overdue">
              <span className="stat-value">{overdueMilestones.length}</span>
              <span className="stat-label">overdue</span>
            </div>
          )}
        </div>
      </div>

      <button className="widget-view-btn" onClick={onViewPlan}>
        View Full Plan →
      </button>
    </div>
  );
}

export default SuccessPlan;

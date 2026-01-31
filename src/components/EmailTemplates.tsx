/**
 * Email Templates Component
 * 
 * A comprehensive email template system for customer success outreach.
 * Can be used as a modal or inline section in the Account360 view.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  emailTemplates,
  templateCategories,
  interpolateTemplate,
  generateMailtoUrl,
  type EmailTemplate,
  type TemplatePlaceholders,
  type TemplateCategory,
} from '../lib/email-templates';
import type { AccountDetail } from '../lib/types/account';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailTemplatesProps {
  account: AccountDetail;
  onClose?: () => void;
  suggestedAlertType?: string;
}

interface EmailDraft {
  id: string;
  templateId: string;
  subject: string;
  body: string;
  recipientEmail: string;
  savedAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get recommended template categories based on account state
 */
function getRecommendedCategories(account: AccountDetail, suggestedAlertType?: string): TemplateCategory[] {
  const categories: TemplateCategory[] = [];
  
  // Based on suggested alert type
  if (suggestedAlertType) {
    const alertTypeToCategory: Record<string, TemplateCategory> = {
      'churn_risk': 'at_risk',
      'usage_decline': 'reactivation',
      'low_engagement': 'reactivation',
      'onboarding_stalled': 'onboarding',
      'expansion_opportunity': 'expansion',
      'renewal_approaching': 'renewal',
    };
    const mapped = alertTypeToCategory[suggestedAlertType];
    if (mapped) categories.push(mapped);
  }
  
  // Based on lifecycle stage
  if (account.lifecycleStage === 'onboarding') {
    categories.push('onboarding');
  }
  if (account.lifecycleStage === 'renewal') {
    categories.push('renewal');
  }
  
  // Based on health score
  if (account.health.score < 50) {
    if (!categories.includes('at_risk')) categories.push('at_risk');
  }
  
  // Based on days since activity
  if (account.usage.daysSinceLastActivity > 14) {
    if (!categories.includes('reactivation')) categories.push('reactivation');
  }
  
  // Based on commercial signals
  if (account.commercial.daysToRenewal && account.commercial.daysToRenewal <= 60) {
    categories.push('renewal');
  }
  
  // Based on expansion signals
  if (account.commercial.expansionPotential === 'high') {
    categories.push('expansion');
  }
  
  return [...new Set(categories)]; // Remove duplicates
}

/**
 * Calculate recommendation score for a template based on account context
 */
function getTemplateRecommendationScore(
  template: EmailTemplate,
  account: AccountDetail,
  recommendedCategories: TemplateCategory[]
): number {
  let score = 0;
  
  // Category match
  if (recommendedCategories.includes(template.category)) {
    score += 50;
  }
  
  // Specific template matching
  const daysSince = account.usage.daysSinceLastActivity;
  const daysToRenewal = account.commercial.daysToRenewal;
  
  // Onboarding timing
  if (template.id === 'onboarding-day-7' && daysSince >= 5 && daysSince <= 10) {
    score += 30;
  }
  if (template.id === 'onboarding-day-14' && daysSince >= 12 && daysSince <= 18) {
    score += 30;
  }
  if (template.id === 'onboarding-day-30' && daysSince >= 28 && daysSince <= 35) {
    score += 30;
  }
  
  // Renewal timing
  if (daysToRenewal) {
    if (template.id === 'renewal-60-days' && daysToRenewal >= 55 && daysToRenewal <= 70) {
      score += 40;
    }
    if (template.id === 'renewal-30-days' && daysToRenewal >= 25 && daysToRenewal <= 35) {
      score += 40;
    }
    if (template.id === 'renewal-7-days' && daysToRenewal >= 5 && daysToRenewal <= 10) {
      score += 50; // Higher priority for urgent
    }
  }
  
  // At-risk matching
  if (account.health.score < 40 && template.category === 'at_risk') {
    score += 20;
  }
  
  // Reactivation matching (for inactive accounts)
  if (daysSince > 14 && template.category === 'reactivation') {
    score += 25;
  }
  
  return score;
}

/**
 * Find unfilled placeholders in a string
 */
function findUnfilledPlaceholders(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches)];
}

/**
 * Get category icon
 */
function getCategoryIcon(category: TemplateCategory): string {
  const icons: Record<TemplateCategory, string> = {
    'onboarding': '🚀',
    'at_risk': '⚠️',
    'expansion': '📈',
    'renewal': '🔄',
    'reactivation': '💬',
    'check_in': '📧',
  };
  return icons[category] || '📧';
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface EmailTemplateSelectorProps {
  templates: EmailTemplate[];
  selectedId: string | null;
  onSelect: (template: EmailTemplate) => void;
  recommendedCategories: TemplateCategory[];
  getRecommendationScore: (template: EmailTemplate) => number;
  filterCategory: TemplateCategory | 'all' | 'recommended';
  onFilterChange: (category: TemplateCategory | 'all' | 'recommended') => void;
}

function EmailTemplateSelector({
  templates,
  selectedId,
  onSelect,
  recommendedCategories,
  getRecommendationScore,
  filterCategory,
  onFilterChange,
}: EmailTemplateSelectorProps) {
  // Filter and sort templates
  const displayedTemplates = useMemo(() => {
    let filtered = templates;
    
    if (filterCategory === 'recommended') {
      filtered = templates.filter(t => getRecommendationScore(t) > 0);
    } else if (filterCategory !== 'all') {
      filtered = templates.filter(t => t.category === filterCategory);
    }
    
    // Sort by recommendation score (descending), then by category
    return [...filtered].sort((a, b) => {
      const scoreA = getRecommendationScore(a);
      const scoreB = getRecommendationScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.category.localeCompare(b.category);
    });
  }, [templates, filterCategory, getRecommendationScore]);

  // Group templates by category for display
  const groupedTemplates = useMemo(() => {
    const groups: Record<TemplateCategory, EmailTemplate[]> = {
      onboarding: [],
      check_in: [],
      at_risk: [],
      expansion: [],
      renewal: [],
      reactivation: [],
    };
    
    displayedTemplates.forEach(t => {
      groups[t.category].push(t);
    });
    
    return groups;
  }, [displayedTemplates]);

  const hasRecommended = templates.some(t => getRecommendationScore(t) > 0);

  return (
    <div className="email-template-selector">
      {/* Category Filter */}
      <div className="template-category-filter">
        <button
          className={`category-filter-btn ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          All
        </button>
        {hasRecommended && (
          <button
            className={`category-filter-btn recommended ${filterCategory === 'recommended' ? 'active' : ''}`}
            onClick={() => onFilterChange('recommended')}
          >
            ⭐ Recommended
          </button>
        )}
        {templateCategories.map(cat => (
          <button
            key={cat.value}
            className={`category-filter-btn ${filterCategory === cat.value ? 'active' : ''} ${recommendedCategories.includes(cat.value) ? 'has-recommendations' : ''}`}
            onClick={() => onFilterChange(cat.value)}
          >
            {getCategoryIcon(cat.value)} {cat.label}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div className="template-grid">
        {filterCategory === 'all' ? (
          // Show grouped by category
          Object.entries(groupedTemplates)
            .filter(([, templates]) => templates.length > 0)
            .map(([category, categoryTemplates]) => (
              <div key={category} className="template-group">
                <h4 className="template-group-title">
                  {getCategoryIcon(category as TemplateCategory)} {templateCategories.find(c => c.value === category)?.label}
                </h4>
                <div className="template-group-items">
                  {categoryTemplates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      isSelected={selectedId === template.id}
                      isRecommended={getRecommendationScore(template) > 30}
                      onClick={() => onSelect(template)}
                    />
                  ))}
                </div>
              </div>
            ))
        ) : (
          // Show flat list
          <div className="template-group-items">
            {displayedTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                isSelected={selectedId === template.id}
                isRecommended={getRecommendationScore(template) > 30}
                onClick={() => onSelect(template)}
              />
            ))}
          </div>
        )}
        
        {displayedTemplates.length === 0 && (
          <div className="template-empty-state">
            <p>No templates match the current filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: EmailTemplate;
  isSelected: boolean;
  isRecommended: boolean;
  onClick: () => void;
}

function TemplateCard({ template, isSelected, isRecommended, onClick }: TemplateCardProps) {
  return (
    <button
      className={`template-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
      onClick={onClick}
    >
      {isRecommended && <span className="template-recommended-badge">⭐ Recommended</span>}
      <span className="template-card-name">{template.name}</span>
      {template.description && (
        <span className="template-card-description">{template.description}</span>
      )}
    </button>
  );
}

interface EmailPreviewProps {
  template: EmailTemplate | null;
  subject: string;
  body: string;
  recipientEmail: string;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onRecipientChange: (email: string) => void;
  unfilledPlaceholders: string[];
}

function EmailPreview({
  template,
  subject,
  body,
  recipientEmail,
  onSubjectChange,
  onBodyChange,
  onRecipientChange,
  unfilledPlaceholders,
}: EmailPreviewProps) {
  if (!template) {
    return (
      <div className="email-preview email-preview-empty">
        <div className="preview-empty-icon">📧</div>
        <h3>Select a Template</h3>
        <p>Choose a template from the left to preview and customize it.</p>
      </div>
    );
  }

  return (
    <div className="email-preview">
      <div className="email-preview-header">
        <h3>📝 Preview & Edit</h3>
        <span className="preview-template-name">{template.name}</span>
      </div>

      {/* Recipient Field */}
      <div className="email-field">
        <label htmlFor="email-recipient">To:</label>
        <input
          id="email-recipient"
          type="email"
          value={recipientEmail}
          onChange={(e) => onRecipientChange(e.target.value)}
          placeholder="recipient@example.com"
          className="email-field-input"
        />
      </div>

      {/* Subject Field */}
      <div className="email-field">
        <label htmlFor="email-subject">Subject:</label>
        <input
          id="email-subject"
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className="email-field-input"
        />
      </div>

      {/* Body Field */}
      <div className="email-field email-body-field">
        <label htmlFor="email-body">Body:</label>
        <textarea
          id="email-body"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          className="email-body-textarea"
          rows={15}
        />
      </div>

      {/* Unfilled Placeholders Warning */}
      {unfilledPlaceholders.length > 0 && (
        <div className="email-placeholders-warning">
          <span className="warning-icon">⚠️</span>
          <div className="warning-content">
            <span className="warning-title">Unfilled placeholders:</span>
            <div className="placeholder-list">
              {unfilledPlaceholders.map((placeholder, idx) => (
                <span key={idx} className="placeholder-tag">{placeholder}</span>
              ))}
            </div>
            <span className="warning-hint">Edit the body above to fill in these values.</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface EmailActionsProps {
  subject: string;
  body: string;
  recipientEmail: string;
  templateId: string | null;
  accountId: string;
  onSaveDraft: () => void;
  hasDraft: boolean;
  disabled: boolean;
}

function EmailActions({
  subject,
  body,
  recipientEmail,
  templateId,
  onSaveDraft,
  hasDraft,
  disabled,
}: EmailActionsProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleCopyToClipboard = useCallback(async () => {
    const fullEmail = `Subject: ${subject}\n\n${body}`;
    
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [subject, body]);

  const handleOpenInEmailClient = useCallback(() => {
    const mailtoUrl = generateMailtoUrl(recipientEmail, subject, body);
    window.location.href = mailtoUrl;
  }, [recipientEmail, subject, body]);

  const handleSaveDraft = useCallback(() => {
    onSaveDraft();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [onSaveDraft]);

  return (
    <div className="email-actions">
      <div className="email-actions-group">
        <button
          className="email-action-btn btn-secondary"
          onClick={handleCopyToClipboard}
          disabled={disabled}
          title="Copy subject and body to clipboard"
        >
          {copySuccess ? '✓ Copied!' : '📋 Copy to Clipboard'}
        </button>
        
        <button
          className="email-action-btn btn-primary"
          onClick={handleOpenInEmailClient}
          disabled={disabled || !recipientEmail}
          title={!recipientEmail ? 'Enter a recipient email first' : 'Open in default email client'}
        >
          📤 Open in Email Client
        </button>
      </div>

      <div className="email-actions-secondary">
        <button
          className="email-action-btn btn-ghost"
          onClick={handleSaveDraft}
          disabled={disabled || !templateId}
          title="Save as draft for later"
        >
          {saveSuccess ? '✓ Saved!' : hasDraft ? '💾 Update Draft' : '💾 Save Draft'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EmailTemplates({ account, onClose, suggestedAlertType }: EmailTemplatesProps) {
  const DRAFTS_KEY = `arda_email_drafts_${account.id}`;
  
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'all' | 'recommended'>('recommended');
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [drafts, setDrafts] = useState<EmailDraft[]>(() => {
    const stored = localStorage.getItem(DRAFTS_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  // Get recommended categories based on account state
  const recommendedCategories = useMemo(
    () => getRecommendedCategories(account, suggestedAlertType),
    [account, suggestedAlertType]
  );

  // Initialize filter based on recommendations
  useEffect(() => {
    const hasRecommendations = emailTemplates.some(
      t => getTemplateRecommendationScore(t, account, recommendedCategories) > 0
    );
    setFilterCategory(hasRecommendations ? 'recommended' : 'all');
  }, [account, recommendedCategories]);

  // Build placeholders from account data
  const placeholders: TemplatePlaceholders = useMemo(() => {
    const primaryContact = account.stakeholders?.find(s => s.isPrimary);
    const firstName = primaryContact?.name?.split(' ')[0] || '';
    
    return {
      accountName: account.name,
      contactName: primaryContact?.name,
      contactFirstName: firstName,
      companyName: account.name,
      csmName: account.ownerName || 'Your CSM',
      csmEmail: account.ownerEmail || '',
      activeUsers: account.usage.activeUsersLast30Days,
      totalUsers: account.usage.totalUsers,
      daysSinceActivity: account.usage.daysSinceLastActivity,
      healthScore: account.health.score,
      daysToRenewal: account.commercial.daysToRenewal,
      arr: account.commercial.arr,
      itemCount: account.usage.itemCount,
      kanbanCardCount: account.usage.kanbanCardCount,
      orderCount: account.usage.orderCount,
    };
  }, [account]);

  // Set initial recipient email from primary stakeholder
  useEffect(() => {
    const primaryContact = account.stakeholders?.find(s => s.isPrimary);
    if (primaryContact?.email) {
      setRecipientEmail(primaryContact.email);
    }
  }, [account.stakeholders]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: EmailTemplate) => {
    setSelectedTemplate(template);
    
    // Check for existing draft
    const existingDraft = drafts.find(d => d.templateId === template.id);
    
    if (existingDraft) {
      setEditedSubject(existingDraft.subject);
      setEditedBody(existingDraft.body);
      if (existingDraft.recipientEmail) {
        setRecipientEmail(existingDraft.recipientEmail);
      }
    } else {
      // Interpolate template with account data
      setEditedSubject(interpolateTemplate(template.subject, placeholders));
      setEditedBody(interpolateTemplate(template.body, placeholders));
    }
  }, [drafts, placeholders]);

  // Get recommendation score for a template
  const getRecommendationScore = useCallback(
    (template: EmailTemplate) => getTemplateRecommendationScore(template, account, recommendedCategories),
    [account, recommendedCategories]
  );

  // Find unfilled placeholders
  const unfilledPlaceholders = useMemo(
    () => [...findUnfilledPlaceholders(editedSubject), ...findUnfilledPlaceholders(editedBody)],
    [editedSubject, editedBody]
  );

  // Check if current template has a draft
  const hasDraft = useMemo(
    () => selectedTemplate ? drafts.some(d => d.templateId === selectedTemplate.id) : false,
    [selectedTemplate, drafts]
  );

  // Save draft
  const handleSaveDraft = useCallback(() => {
    if (!selectedTemplate) return;

    const now = new Date().toISOString();
    const draft: EmailDraft = {
      id: `draft_${selectedTemplate.id}`,
      templateId: selectedTemplate.id,
      subject: editedSubject,
      body: editedBody,
      recipientEmail,
      savedAt: now,
    };

    setDrafts(prev => {
      const filtered = prev.filter(d => d.templateId !== selectedTemplate.id);
      const updated = [...filtered, draft];
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [selectedTemplate, editedSubject, editedBody, recipientEmail, DRAFTS_KEY]);

  return (
    <div className="email-templates-container">
      {/* Header */}
      <div className="email-templates-header">
        <div className="email-templates-title">
          <h2>📧 Email Templates</h2>
          <span className="email-templates-subtitle">
            Compose outreach for {account.name}
          </span>
        </div>
        {onClose && (
          <button className="email-templates-close" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Context Banner */}
      {recommendedCategories.length > 0 && (
        <div className="email-context-banner">
          <span className="context-icon">💡</span>
          <span className="context-text">
            Based on account status, we recommend: {recommendedCategories.map(c => 
              templateCategories.find(tc => tc.value === c)?.label
            ).join(', ')}
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="email-templates-content">
        {/* Left Panel - Template Selection */}
        <div className="email-templates-sidebar">
          <EmailTemplateSelector
            templates={emailTemplates}
            selectedId={selectedTemplate?.id || null}
            onSelect={handleSelectTemplate}
            recommendedCategories={recommendedCategories}
            getRecommendationScore={getRecommendationScore}
            filterCategory={filterCategory}
            onFilterChange={setFilterCategory}
          />
        </div>

        {/* Right Panel - Preview & Edit */}
        <div className="email-templates-main">
          <EmailPreview
            template={selectedTemplate}
            subject={editedSubject}
            body={editedBody}
            recipientEmail={recipientEmail}
            onSubjectChange={setEditedSubject}
            onBodyChange={setEditedBody}
            onRecipientChange={setRecipientEmail}
            unfilledPlaceholders={unfilledPlaceholders}
          />

          <EmailActions
            subject={editedSubject}
            body={editedBody}
            recipientEmail={recipientEmail}
            templateId={selectedTemplate?.id || null}
            accountId={account.id}
            onSaveDraft={handleSaveDraft}
            hasDraft={hasDraft}
            disabled={!selectedTemplate}
          />
        </div>
      </div>

      {/* Drafts Indicator */}
      {drafts.length > 0 && (
        <div className="email-drafts-indicator">
          <span className="drafts-icon">💾</span>
          <span className="drafts-text">{drafts.length} saved draft{drafts.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL WRAPPER
// ============================================================================

interface EmailTemplatesModalProps extends EmailTemplatesProps {
  isOpen: boolean;
}

export function EmailTemplatesModal({ isOpen, ...props }: EmailTemplatesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="email-templates-modal-overlay" onClick={props.onClose}>
      <div className="email-templates-modal" onClick={e => e.stopPropagation()}>
        <EmailTemplates {...props} />
      </div>
    </div>
  );
}

export default EmailTemplates;

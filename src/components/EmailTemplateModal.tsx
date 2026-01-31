/**
 * Email Template Modal Component
 * 
 * A modal for selecting, previewing, and using email templates
 * for customer success outreach.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  emailTemplates,
  templateCategories,
  interpolateTemplate,
  generateMailtoUrl,
  type TemplatePlaceholders,
  type TemplateCategory,
} from '../lib/email-templates';

// ============================================================================
// TYPES
// ============================================================================

interface EmailTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: TemplateCategory;
  accountData?: {
    name?: string;
    primaryContactEmail?: string;
    primaryContactName?: string;
    csmName?: string;
    csmEmail?: string;
    csmPhone?: string;
    activeUsers?: number;
    totalUsers?: number;
    daysSinceLastActivity?: number;
    healthScore?: number;
    daysToRenewal?: number;
    arr?: number;
    itemCount?: number;
    kanbanCardCount?: number;
    orderCount?: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EmailTemplateModal({
  isOpen,
  onClose,
  defaultCategory,
  accountData,
}: EmailTemplateModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>(defaultCategory || 'all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState(accountData?.primaryContactEmail || '');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Update category when defaultCategory prop changes
  useEffect(() => {
    if (defaultCategory) {
      setSelectedCategory(defaultCategory);
    }
  }, [defaultCategory]);

  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(accountData?.primaryContactEmail || '');
    }
  }, [isOpen, accountData?.primaryContactEmail]);

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return emailTemplates;
    }
    return emailTemplates.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // Get selected template
  const selectedTemplate = useMemo(() => {
    return emailTemplates.find(t => t.id === selectedTemplateId);
  }, [selectedTemplateId]);

  // Build placeholders from account data
  const placeholders: TemplatePlaceholders = useMemo(() => {
    const firstName = accountData?.primaryContactName?.split(' ')[0] || '';
    return {
      accountName: accountData?.name,
      contactName: accountData?.primaryContactName,
      contactFirstName: firstName,
      companyName: accountData?.name,
      csmName: accountData?.csmName || 'Your CSM',
      csmEmail: accountData?.csmEmail || '',
      csmPhone: accountData?.csmPhone || '',
      activeUsers: accountData?.activeUsers,
      totalUsers: accountData?.totalUsers,
      daysSinceActivity: accountData?.daysSinceLastActivity,
      healthScore: accountData?.healthScore,
      daysToRenewal: accountData?.daysToRenewal,
      arr: accountData?.arr,
      itemCount: accountData?.itemCount,
      kanbanCardCount: accountData?.kanbanCardCount,
      orderCount: accountData?.orderCount,
    };
  }, [accountData]);

  // Interpolated content
  const interpolatedSubject = useMemo(() => {
    if (!selectedTemplate) return '';
    return interpolateTemplate(selectedTemplate.subject, placeholders);
  }, [selectedTemplate, placeholders]);

  const interpolatedBody = useMemo(() => {
    if (!selectedTemplate) return '';
    return interpolateTemplate(selectedTemplate.body, placeholders);
  }, [selectedTemplate, placeholders]);

  // Copy to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (!selectedTemplate) return;

    const fullEmail = `Subject: ${interpolatedSubject}\n\n${interpolatedBody}`;
    
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [selectedTemplate, interpolatedSubject, interpolatedBody]);

  // Open in email client
  const handleOpenInEmailClient = useCallback(() => {
    if (!selectedTemplate) return;

    const mailtoUrl = generateMailtoUrl(
      recipientEmail,
      interpolatedSubject,
      interpolatedBody
    );

    window.location.href = mailtoUrl;
  }, [selectedTemplate, recipientEmail, interpolatedSubject, interpolatedBody]);

  // Reset when modal closes
  const handleClose = useCallback(() => {
    setSelectedTemplateId('');
    setSelectedCategory('all');
    setCopySuccess(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const hasRecipient = recipientEmail.trim().length > 0;

  return (
    <div className="email-modal-overlay" onClick={handleClose}>
      <div className="email-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="email-modal-header">
          <h2>📧 Email Templates</h2>
          <button className="email-modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="email-modal-content">
          {/* Left Panel - Template Selection */}
          <div className="email-modal-sidebar">
            {/* Category Filter */}
            <div className="email-category-filter">
              <label htmlFor="category-select">Category</label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
                className="email-category-select"
              >
                <option value="all">All Templates</option>
                {templateCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Template List */}
            <div className="email-template-list">
              {filteredTemplates.map(template => (
                <button
                  key={template.id}
                  className={`email-template-item ${selectedTemplateId === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <span className="template-name">{template.name}</span>
                  <span className="template-category">{getCategoryLabel(template.category)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="email-modal-preview">
            {selectedTemplate ? (
              <>
                {/* Recipient Input */}
                <div className="email-recipient-field">
                  <label htmlFor="recipient-email">To:</label>
                  <input
                    id="recipient-email"
                    type="email"
                    value={recipientEmail}
                    onChange={e => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="email-recipient-input"
                  />
                </div>

                {!hasRecipient && (
                  <div className="email-recipient-warning">
                    Add a primary contact email to enable one-click sending.
                  </div>
                )}

                {/* Subject Preview */}
                <div className="email-preview-field">
                  <label>Subject:</label>
                  <div className="email-preview-subject">{interpolatedSubject}</div>
                </div>

                {/* Body Preview */}
                <div className="email-preview-field email-preview-body-container">
                  <label>Body:</label>
                  <div className="email-preview-body">
                    <pre>{interpolatedBody}</pre>
                  </div>
                </div>

                {/* Placeholders Note */}
                <div className="email-placeholders-note">
                  <span className="note-icon">ℹ️</span>
                  <span>
                    Placeholders like {"{{contactFirstName}}"} will need to be filled in manually if the data isn't available.
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="email-modal-actions">
                  <button
                    className="btn-secondary email-action-btn"
                    onClick={handleCopyToClipboard}
                  >
                    {copySuccess ? '✓ Copied!' : '📋 Copy to Clipboard'}
                  </button>
                  <button
                    className="btn-primary email-action-btn"
                    onClick={handleOpenInEmailClient}
                    disabled={!hasRecipient}
                  >
                    📤 Open in Email Client
                  </button>
                </div>
              </>
            ) : (
              <div className="email-preview-empty">
                <div className="empty-icon">📧</div>
                <p>Select a template from the list to preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function
function getCategoryLabel(category: TemplateCategory): string {
  const cat = templateCategories.find(c => c.value === category);
  return cat?.label || category;
}

export default EmailTemplateModal;

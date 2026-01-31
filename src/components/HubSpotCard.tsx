/**
 * HubSpot Card Component
 * 
 * A reusable card for displaying HubSpot CRM data including
 * company summary, contact list, and deal pipeline visualization.
 */

import React from 'react';
import {
  type HubSpotCompany,
  type HubSpotContact,
  type HubSpotDeal,
  type HubSpotOwner,
  formatCompanySize,
  formatLifecycleStage,
  getDealStageColor,
  getContactFullName,
} from '../hooks/useHubSpotData';

// ============================================================================
// HubSpot Icon Component
// ============================================================================

function HubSpotIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hubspot-icon"
    >
      <path
        d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.198 2.198 0 00-4.396 0 2.198 2.198 0 001.267 1.984V7.93a5.166 5.166 0 00-2.601 1.205l-6.876-5.35a2.303 2.303 0 00.066-.518A2.277 2.277 0 004.614 1 2.277 2.277 0 002.337 3.277 2.277 2.277 0 004.614 5.554c.37 0 .72-.089 1.03-.246l6.769 5.266a5.18 5.18 0 00-.654 2.519c0 .93.244 1.802.67 2.558l-2.065 2.065a1.752 1.752 0 00-.514-.08 1.765 1.765 0 00-1.765 1.765 1.765 1.765 0 001.765 1.765 1.765 1.765 0 001.765-1.765c0-.18-.027-.354-.077-.518l2.037-2.037a5.183 5.183 0 003.497 1.353 5.19 5.19 0 005.19-5.19 5.19 5.19 0 00-5.19-5.19 5.18 5.18 0 00-2.878.871zm.908 7.36a2.197 2.197 0 01-2.197-2.197 2.197 2.197 0 012.197-2.197 2.197 2.197 0 012.197 2.197 2.197 2.197 0 01-2.197 2.197z"
        fill="#FF7A59"
      />
    </svg>
  );
}

// ============================================================================
// HubSpot Link Button
// ============================================================================

interface HubSpotLinkProps {
  url: string;
  label?: string;
  variant?: 'icon' | 'button' | 'text';
}

export function HubSpotLink({ url, label = 'View in HubSpot', variant = 'icon' }: HubSpotLinkProps) {
  if (variant === 'icon') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hubspot-link-icon"
        title={label}
      >
        <HubSpotIcon size={14} />
      </a>
    );
  }
  
  if (variant === 'button') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="hubspot-link-btn btn-secondary"
      >
        <HubSpotIcon size={14} />
        <span>{label}</span>
      </a>
    );
  }
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="hubspot-link-text"
    >
      <HubSpotIcon size={12} />
      <span>{label}</span>
    </a>
  );
}

// ============================================================================
// Sync Button
// ============================================================================

interface SyncButtonProps {
  onSync: () => void;
  isLoading?: boolean;
  lastSyncedAt?: string;
}

export function SyncFromHubSpotButton({ onSync, isLoading, lastSyncedAt }: SyncButtonProps) {
  const formatSyncTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return d.toLocaleDateString();
  };
  
  return (
    <div className="hubspot-sync-wrapper">
      <button
        onClick={onSync}
        disabled={isLoading}
        className="hubspot-sync-btn btn-secondary"
      >
        <span className={`sync-icon ${isLoading ? 'spinning' : ''}`}>🔄</span>
        <span>{isLoading ? 'Syncing...' : 'Sync from HubSpot'}</span>
      </button>
      {lastSyncedAt && (
        <span className="last-synced">
          Last synced: {formatSyncTime(lastSyncedAt)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Company Summary Card
// ============================================================================

interface CompanySummaryProps {
  company: HubSpotCompany;
  owner?: HubSpotOwner | null;
  onSync?: () => void;
  isLoading?: boolean;
  lastSyncedAt?: string;
}

export function HubSpotCompanySummary({ company, owner, onSync, isLoading, lastSyncedAt }: CompanySummaryProps) {
  const location = [company.location?.city, company.location?.state, company.location?.country]
    .filter(Boolean)
    .join(', ');
  
  return (
    <div className="hubspot-company-summary glass-card">
      <div className="hubspot-card-header">
        <div className="hubspot-card-title">
          <HubSpotIcon size={20} />
          <h3>CRM Overview</h3>
        </div>
        <div className="hubspot-card-actions">
          {onSync && (
            <SyncFromHubSpotButton
              onSync={onSync}
              isLoading={isLoading}
              lastSyncedAt={lastSyncedAt}
            />
          )}
          <HubSpotLink url={company.hubspotUrl} variant="button" label="Open in HubSpot" />
        </div>
      </div>
      
      <div className="hubspot-company-content">
        <div className="hubspot-company-info">
          <div className="company-info-grid">
            {company.industry && (
              <div className="info-item">
                <span className="info-label">Industry</span>
                <span className="info-value">{company.industry}</span>
              </div>
            )}
            {company.companySize && (
              <div className="info-item">
                <span className="info-label">Company Size</span>
                <span className="info-value">{formatCompanySize(company.companySize)}</span>
              </div>
            )}
            {location && (
              <div className="info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{location}</span>
              </div>
            )}
            {company.annualRevenue && (
              <div className="info-item">
                <span className="info-label">Annual Revenue</span>
                <span className="info-value">
                  ${(company.annualRevenue / 1000000).toFixed(1)}M
                </span>
              </div>
            )}
          </div>
        </div>
        
        {owner && (
          <div className="hubspot-owner-section">
            <span className="owner-label">HubSpot Owner</span>
            <div className="owner-info">
              <div className="owner-avatar">
                {owner.avatarUrl ? (
                  <img src={owner.avatarUrl} alt={owner.fullName} />
                ) : (
                  <span>{owner.fullName.charAt(0)}</span>
                )}
              </div>
              <div className="owner-details">
                <span className="owner-name">{owner.fullName}</span>
                <span className="owner-email">{owner.email}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Contact List
// ============================================================================

interface ContactListProps {
  contacts: HubSpotContact[];
  maxDisplay?: number;
  showViewAll?: boolean;
}

export function HubSpotContactList({ contacts, maxDisplay = 5, showViewAll = true }: ContactListProps) {
  const displayContacts = contacts.slice(0, maxDisplay);
  const hasMore = contacts.length > maxDisplay;
  
  const formatLastActivity = (date?: string) => {
    if (!date) return 'No activity';
    
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return d.toLocaleDateString();
  };
  
  return (
    <div className="hubspot-contact-list">
      {displayContacts.map((contact) => (
        <div key={contact.id} className="hubspot-contact-item">
          <div className="contact-avatar">
            {(contact.firstName || contact.lastName) ? (
              <span>
                {contact.firstName?.charAt(0) || ''}
                {contact.lastName?.charAt(0) || ''}
              </span>
            ) : (
              <span>@</span>
            )}
          </div>
          
          <div className="contact-info">
            <div className="contact-header">
              <span className="contact-name">{getContactFullName(contact)}</span>
              <HubSpotLink url={contact.hubspotUrl} />
            </div>
            {contact.jobTitle && (
              <span className="contact-title">{contact.jobTitle}</span>
            )}
            <div className="contact-meta">
              <span className="contact-email">{contact.email}</span>
              {contact.phone && (
                <span className="contact-phone">{contact.phone}</span>
              )}
            </div>
            <div className="contact-badges">
              {contact.lifecycleStage && (
                <span className={`lifecycle-stage-badge stage-${contact.lifecycleStage.toLowerCase()}`}>
                  {formatLifecycleStage(contact.lifecycleStage)}
                </span>
              )}
              <span className="last-activity">
                Last activity: {formatLastActivity(contact.lastActivityDate)}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {contacts.length === 0 && (
        <p className="empty-state-small">No contacts found in HubSpot</p>
      )}
      
      {hasMore && showViewAll && (
        <div className="view-more-contacts">
          <span>+{contacts.length - maxDisplay} more contacts in HubSpot</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Deal Pipeline
// ============================================================================

interface DealPipelineProps {
  deals: HubSpotDeal[];
}

export function HubSpotDealPipeline({ deals }: DealPipelineProps) {
  const formatCurrency = (amount?: number, currency = 'USD') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  const formatCloseDate = (date?: string) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  
  const getDealTypeIcon = (type?: string) => {
    switch (type) {
      case 'expansion': return '📈';
      case 'renewal': return '🔄';
      case 'new_business': return '🆕';
      default: return '💼';
    }
  };
  
  // Calculate total pipeline value
  const totalPipeline = deals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const openDeals = deals.filter(d => !d.stage.toLowerCase().includes('closed'));
  
  return (
    <div className="hubspot-deal-pipeline">
      <div className="pipeline-header">
        <div className="pipeline-summary">
          <span className="pipeline-count">{openDeals.length} open deal{openDeals.length !== 1 ? 's' : ''}</span>
          <span className="pipeline-value">
            Total: {formatCurrency(totalPipeline)}
          </span>
        </div>
      </div>
      
      <div className="pipeline-deals">
        {deals.map((deal) => {
          const stageColor = getDealStageColor(deal.stage);
          
          return (
            <div key={deal.id} className={`deal-item stage-${stageColor}`}>
              <div className="deal-header">
                <span className="deal-type-icon">{getDealTypeIcon(deal.dealType)}</span>
                <span className="deal-name">{deal.name}</span>
                <HubSpotLink url={deal.hubspotUrl} />
              </div>
              
              <div className="deal-details">
                <div className="deal-amount">
                  {formatCurrency(deal.amount, deal.currency)}
                </div>
                
                <div className="deal-meta">
                  <span className={`deal-stage stage-badge-${stageColor}`}>
                    {deal.stage}
                  </span>
                  {deal.probability !== undefined && (
                    <span className="deal-probability">
                      {deal.probability}% likely
                    </span>
                  )}
                </div>
                
                {deal.closeDate && (
                  <span className="deal-close-date">
                    Close: {formatCloseDate(deal.closeDate)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        
        {deals.length === 0 && (
          <p className="empty-state-small">No deals found in HubSpot</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Complete HubSpot Card
// ============================================================================

interface HubSpotCardProps {
  company: HubSpotCompany | null;
  contacts: HubSpotContact[];
  deals: HubSpotDeal[];
  owner?: HubSpotOwner | null;
  onSync?: () => void;
  isLoading?: boolean;
  lastSyncedAt?: string;
  showContacts?: boolean;
  showDeals?: boolean;
  maxContacts?: number;
}

export function HubSpotCard({
  company,
  contacts,
  deals,
  owner,
  onSync,
  isLoading,
  lastSyncedAt,
  showContacts = true,
  showDeals = true,
  maxContacts = 3,
}: HubSpotCardProps) {
  if (!company) {
    return (
      <div className="hubspot-card hubspot-card-empty glass-card">
        <div className="hubspot-card-header">
          <div className="hubspot-card-title">
            <HubSpotIcon size={20} />
            <h3>HubSpot CRM</h3>
          </div>
        </div>
        <div className="hubspot-empty-content">
          <p>No HubSpot company record found for this account.</p>
          {onSync && (
            <button onClick={onSync} className="btn-secondary" disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search HubSpot'}
            </button>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className="hubspot-card glass-card">
      <HubSpotCompanySummary
        company={company}
        owner={owner}
        onSync={onSync}
        isLoading={isLoading}
        lastSyncedAt={lastSyncedAt}
      />
      
      {showContacts && contacts.length > 0 && (
        <div className="hubspot-section">
          <h4>📇 Contacts ({contacts.length})</h4>
          <HubSpotContactList contacts={contacts} maxDisplay={maxContacts} />
        </div>
      )}
      
      {showDeals && deals.length > 0 && (
        <div className="hubspot-section">
          <h4>💼 Active Deals ({deals.length})</h4>
          <HubSpotDealPipeline deals={deals} />
        </div>
      )}
    </div>
  );
}

export default HubSpotCard;

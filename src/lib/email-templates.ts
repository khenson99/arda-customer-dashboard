/**
 * Email Templates for Customer Success Outreach
 * 
 * Pre-built templates for common CS scenarios with placeholder interpolation.
 * Templates are categorized by lifecycle stage and tagged with suggested use cases.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TemplateCategory = 
  | 'onboarding'
  | 'check_in'
  | 'at_risk'
  | 'expansion'
  | 'renewal'
  | 'reactivation';

export interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;  // Use {{variable}} placeholders
  variables: string[];  // List of variables used in the template
  suggestedFor: string[];  // Alert types or lifecycle stages this is good for
  description?: string;
}

export interface TemplatePlaceholders {
  // Customer/Account
  customerName?: string;
  companyName?: string;
  accountName?: string;
  contactName?: string;
  contactFirstName?: string;
  
  // CSM Info
  csmName?: string;
  csmEmail?: string;
  csmPhone?: string;
  
  // Metrics & Health
  healthScore?: number;
  daysInactive?: number;
  daysSinceActivity?: number;
  activeUsers?: number;
  totalUsers?: number;
  usageMetric?: string;
  
  // Financial & Renewal
  renewalDate?: string;
  arrValue?: number;
  arr?: number;
  daysToRenewal?: number;
  
  // Engagement
  championName?: string;
  newChampionName?: string;
  topFeature?: string;
  itemCount?: number;
  kanbanCardCount?: number;
  orderCount?: number;
  
  // Training & Events
  trainingDate?: string;
  trainingTime?: string;
  trainingLink?: string;
  webinarDate?: string;
  webinarLink?: string;
  
  // Offers & Promos
  discountPercent?: number;
  offerExpiry?: string;
  newFeature?: string;
  
  // Custom
  customMessage?: string;
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

export const emailTemplates: EmailTemplate[] = [
  // ===========================================================================
  // ONBOARDING TEMPLATES
  // ===========================================================================
  {
    id: 'onboarding-welcome',
    name: 'Welcome & Kickoff',
    category: 'onboarding',
    description: 'Initial welcome email after new customer signs up',
    subject: 'Welcome to Arda, {{companyName}}! Let\'s get you started',
    body: `Hi {{customerName}},

Welcome to Arda! I'm {{csmName}}, your dedicated Customer Success Manager, and I'm thrilled to have {{companyName}} join our community.

I'll be your primary point of contact throughout your journey with us. My goal is to ensure you get the maximum value from Arda and achieve your business objectives.

Here's what to expect over the next few weeks:
• Week 1: Initial setup and configuration
• Week 2: Team onboarding and training
• Week 3-4: Optimization and best practices review

I'd love to schedule a kickoff call to:
✓ Understand your specific goals and use cases
✓ Create a customized onboarding plan
✓ Answer any initial questions you might have

Please reply with a few times that work for you this week, or book directly on my calendar.

I'm excited to partner with you!

Best regards,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'csmName', 'csmEmail'],
    suggestedFor: ['new_customer', 'contract_signed', 'trial_conversion'],
  },
  {
    id: 'onboarding-week-1',
    name: 'First Week Check-in',
    category: 'onboarding',
    description: 'Check-in after the first week of usage',
    subject: 'How\'s your first week with Arda going, {{customerName}}?',
    body: `Hi {{customerName}},

I hope your first week with Arda has been going well! I wanted to check in and see how things are progressing at {{companyName}}.

By now, you've likely had a chance to:
• Set up your initial items and inventory
• Explore the dashboard and key features
• Invite your team members to join

I'd love to hear:
- What's working well for you so far?
- Are there any questions or challenges I can help with?
- Is there anything specific you'd like to accomplish this week?

I'm here to make sure you get the most value from Arda. Feel free to reply to this email or book a quick call with me if you'd like to walk through anything together.

Best regards,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'csmName', 'csmEmail'],
    suggestedFor: ['onboarding_week_1', 'new_customer_7_days'],
  },
  {
    id: 'onboarding-training-offer',
    name: 'Training Session Offer',
    category: 'onboarding',
    description: 'Offer a personalized training session during onboarding',
    subject: 'Complimentary Training Session for {{companyName}}',
    body: `Hi {{customerName}},

As part of your onboarding with Arda, I'd like to offer {{companyName}} a complimentary training session tailored to your team's needs.

What we can cover:
📦 Inventory management best practices
📋 Setting up efficient workflows with kanban boards
📊 Using analytics to drive business decisions
👥 Team collaboration and permission settings
🔄 Integrations and automation tips

Training options:
• One-on-one session (30-45 minutes)
• Team training (up to 60 minutes, unlimited attendees)
• Department-specific deep dive

Who should attend:
• Team leads and managers
• Daily users of the platform
• Anyone who will be training others

Would you like to schedule a session? Just reply with your preferences:
1. Preferred format (1:1 or group)
2. Number of attendees
3. Specific topics you'd like to focus on
4. A few time slots that work for your team

Looking forward to helping your team become Arda power users!

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'csmName', 'csmEmail'],
    suggestedFor: ['onboarding', 'low_adoption', 'new_team_members'],
  },

  // ===========================================================================
  // CHECK-IN TEMPLATES
  // ===========================================================================
  {
    id: 'check-in-monthly',
    name: 'Monthly Check-in',
    category: 'check_in',
    description: 'Regular monthly touchpoint with customers',
    subject: 'Monthly Check-in: How\'s {{companyName}} doing with Arda?',
    body: `Hi {{customerName}},

I wanted to reach out for our monthly check-in and see how things are going at {{companyName}}.

Your current stats:
📊 Health Score: {{healthScore}}/100
👥 Active Users: {{activeUsers}}
📦 Items Managed: {{usageMetric}}

A few things I'd like to cover:
• How is Arda helping you achieve your goals?
• Any new initiatives where Arda could add value?
• Feedback on features or improvements you'd like to see?

I'm also happy to share:
• Tips to optimize your current workflows
• Upcoming features on our roadmap
• Success stories from similar companies

Would a 15-20 minute call work this week? Just reply with your availability.

Best,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'healthScore', 'activeUsers', 'usageMetric', 'csmName', 'csmEmail'],
    suggestedFor: ['monthly_check_in', 'regular_touchpoint', 'healthy_account'],
  },
  {
    id: 'check-in-qbr-schedule',
    name: 'QBR Scheduling',
    category: 'check_in',
    description: 'Schedule a Quarterly Business Review',
    subject: 'Let\'s Schedule Your Quarterly Business Review - {{companyName}}',
    body: `Hi {{customerName}},

It's time to schedule {{companyName}}'s Quarterly Business Review (QBR)! This is a great opportunity to step back, review our partnership, and plan for the quarter ahead.

What we'll cover:
📈 Performance Review
   • Key metrics and usage trends
   • ROI analysis and value delivered
   • Health score progression

🎯 Strategic Alignment
   • Your evolving business goals
   • How Arda can better support your objectives
   • Upcoming initiatives and expansion opportunities

🚀 Roadmap Preview
   • New features coming soon
   • Beta opportunities for {{companyName}}
   • Integration possibilities

Recommended attendees from your side:
• Executive sponsor / decision maker
• Day-to-day champion ({{championName}})
• Key stakeholders from affected departments

The QBR typically takes 45-60 minutes. Please let me know:
1. Who should be included?
2. A few date/time options over the next 2 weeks

Looking forward to a productive conversation!

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'championName', 'csmName', 'csmEmail'],
    suggestedFor: ['quarterly_review', 'strategic_account', 'expansion_opportunity'],
  },
  {
    id: 'check-in-feature-announcement',
    name: 'Feature Announcement',
    category: 'check_in',
    description: 'Announce a new feature that would benefit the customer',
    subject: 'New Feature Alert: {{newFeature}} is now available!',
    body: `Hi {{customerName}},

Exciting news! We just launched a new feature that I think {{companyName}} will love: {{newFeature}}.

Based on how your team uses Arda, this could help you:
• Streamline your current workflows
• Save time on repetitive tasks
• Get better insights from your data

Here's what you can do with it:
✓ [Benefit 1 specific to this feature]
✓ [Benefit 2 specific to this feature]
✓ [Benefit 3 specific to this feature]

Want to see it in action?

I'd be happy to give you a quick 15-minute demo and show you how to get started. Just reply to this email or click here to book a time: [Calendar Link]

You can also explore it yourself in your dashboard – look for [location in app].

Let me know what you think once you've had a chance to try it!

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'newFeature', 'csmName', 'csmEmail'],
    suggestedFor: ['feature_release', 'product_update', 'engagement_opportunity'],
  },

  // ===========================================================================
  // AT-RISK TEMPLATES
  // ===========================================================================
  {
    id: 'at-risk-inactivity',
    name: 'Re-engagement After Inactivity',
    category: 'at_risk',
    description: 'Reach out when there has been no activity for an extended period',
    subject: 'We noticed {{companyName}} has been quiet lately',
    body: `Hi {{customerName}},

I noticed that it's been {{daysInactive}} days since we've seen activity from {{companyName}} in Arda, and I wanted to reach out personally.

I understand things can get busy, and priorities shift. But I want you to know that your success matters to us. I'm here to help if:

• You're facing any challenges with the platform
• Your team needs a refresher or additional training
• Your needs have changed and you're not sure if Arda still fits
• You just need a helping hand getting back on track

What I can offer:
🎓 A complimentary 1-on-1 training session for your team
🔧 A personalized setup review to optimize your workflow
📞 A simple conversation to understand what's going on

No pressure – I genuinely want to help.

Would you be open to a 15-minute call this week?

Warm regards,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'daysInactive', 'csmName', 'csmEmail'],
    suggestedFor: ['inactivity_alert', 'usage_drop', 'no_login_30_days'],
  },
  {
    id: 'at-risk-health-score',
    name: 'Health Score Concern',
    category: 'at_risk',
    description: 'Proactive outreach when health score drops significantly',
    subject: 'Checking in on {{companyName}} - How can we help?',
    body: `Hi {{customerName}},

I've been reviewing {{companyName}}'s account and noticed some changes I'd like to discuss with you.

Your current health indicators:
📊 Health Score: {{healthScore}}/100 (down from previous period)
👥 Active Users: {{activeUsers}} of {{totalUsers}}
📉 Days since last activity: {{daysInactive}}

These changes sometimes signal:
• Challenges with the platform we can help solve
• Shifts in team priorities or structure
• Training gaps for new team members
• Unmet needs we should address

I want to understand what's happening and see how I can help. Whether it's a quick training session, a workflow optimization, or just a conversation about your goals – I'm here for you.

Can we schedule a 20-minute call this week? I'd rather address any concerns now than let them grow.

Please reply with your availability, or call me directly at {{csmPhone}}.

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'healthScore', 'activeUsers', 'totalUsers', 'daysInactive', 'csmName', 'csmEmail', 'csmPhone'],
    suggestedFor: ['health_score_drop', 'at_risk_account', 'declining_engagement'],
  },
  {
    id: 'at-risk-champion-left',
    name: 'Champion Left Follow-up',
    category: 'at_risk',
    description: 'Follow up when a key champion leaves the company',
    subject: 'Ensuring continuity at {{companyName}}',
    body: `Hi {{customerName}},

I understand that {{championName}} has recently moved on from {{companyName}}. I wanted to reach out to ensure a smooth transition and continuity of your Arda investment.

{{championName}} was instrumental in:
• Driving adoption across your team
• Establishing best practices and workflows
• Serving as the primary point of contact

I'd like to help you:
✓ Identify and enable a new internal champion
✓ Transfer knowledge and documentation
✓ Provide fresh training for the new point person
✓ Review and optimize your current setup

Who on your team would be the best person to take on this role? I'm happy to:
• Meet with them for a comprehensive handoff
• Provide admin training and best practices
• Set up regular check-ins during the transition

Let's schedule a call to discuss the transition plan. This is a critical moment, and I want to make sure {{companyName}} continues to get full value from Arda.

{{csmName}}
Customer Success Manager
{{csmEmail}} | {{csmPhone}}`,
    variables: ['customerName', 'companyName', 'championName', 'csmName', 'csmEmail', 'csmPhone'],
    suggestedFor: ['champion_churn', 'contact_left', 'stakeholder_change'],
  },

  // ===========================================================================
  // EXPANSION TEMPLATES
  // ===========================================================================
  {
    id: 'expansion-usage-growth',
    name: 'Usage Growth Congratulations',
    category: 'expansion',
    description: 'Celebrate usage milestones and explore expansion',
    subject: 'Congratulations on your growth, {{companyName}}! 🎉',
    body: `Hi {{customerName}},

I had to reach out because I've been watching {{companyName}}'s growth in Arda, and I'm impressed!

Your team has achieved some great milestones:
📈 {{usageMetric}} – fantastic growth!
👥 {{activeUsers}} active users engaged daily
⭐ Your most-used feature: {{topFeature}}

This level of engagement tells me Arda is delivering real value for your team. 

I'm curious:
• What's driving this growth?
• Are there other teams or departments that could benefit?
• How can we support your continued success?

I'd love to explore how we can help {{companyName}} expand this success to other areas of your business. Companies at your stage often benefit from:

✓ Adding seats for new team members
✓ Expanding to additional departments
✓ Upgrading to access advanced features
✓ Implementing additional integrations

Would you have 20 minutes to discuss your growth plans? I can share what similar companies have done to scale their Arda usage.

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'usageMetric', 'activeUsers', 'topFeature', 'csmName', 'csmEmail'],
    suggestedFor: ['usage_spike', 'growth_milestone', 'high_engagement'],
  },
  {
    id: 'expansion-upsell-opportunity',
    name: 'Upsell Opportunity',
    category: 'expansion',
    description: 'Present upgrade options based on usage patterns',
    subject: 'Unlock more value for {{companyName}}',
    body: `Hi {{customerName}},

Based on how {{companyName}} has been using Arda, I wanted to share some opportunities that could help you get even more value.

I've noticed:
• Your team is hitting capacity on {{topFeature}}
• You're using {{usageMetric}} – approaching your plan limits
• {{activeUsers}} users are actively engaged

This is a great problem to have! Here's how an upgrade could help:

🚀 **Expanded Capacity**
   More room to grow without hitting limits

⚡ **Advanced Features**
   Access to [premium feature 1], [premium feature 2], and more

🔗 **Enhanced Integrations**
   Connect with more tools your team uses daily

📊 **Advanced Analytics**
   Deeper insights to drive better decisions

I'd be happy to:
• Give you a preview of the premium features
• Model the ROI based on your current usage
• Create a custom proposal for {{companyName}}

No pressure – just want to make sure you're aware of what's available. Would a quick call be helpful?

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'topFeature', 'usageMetric', 'activeUsers', 'csmName', 'csmEmail'],
    suggestedFor: ['upsell_opportunity', 'plan_limit_approaching', 'upgrade_ready'],
  },
  {
    id: 'expansion-multi-site',
    name: 'Multi-Site Expansion',
    category: 'expansion',
    description: 'Propose expanding to additional locations or teams',
    subject: 'Expanding Arda\'s success across {{companyName}}',
    body: `Hi {{customerName}},

The success we've seen with {{companyName}}'s Arda implementation has been fantastic. Your team has really embraced the platform:

📊 Health Score: {{healthScore}}/100
👥 {{activeUsers}} engaged users
📈 Strong adoption of {{topFeature}}

Given this success, I wanted to explore whether there are opportunities to expand Arda to other parts of {{companyName}}:

🏢 **Additional Locations**
   Do you have other sites, warehouses, or offices that could benefit?

🏛️ **Other Departments**
   Could teams like operations, procurement, or fulfillment use similar workflows?

🤝 **Partner Organizations**
   Any sister companies or partners with similar needs?

Companies that expand across multiple sites often see:
• Standardized processes and reporting
• Better visibility across locations
• Economies of scale on pricing
• Centralized data and insights

I'd love to understand your organization's structure and identify where else Arda could add value. Would you be open to a strategic conversation about this?

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'healthScore', 'activeUsers', 'topFeature', 'csmName', 'csmEmail'],
    suggestedFor: ['expansion_opportunity', 'multi_site', 'department_expansion'],
  },

  // ===========================================================================
  // RENEWAL TEMPLATES
  // ===========================================================================
  {
    id: 'renewal-90-days',
    name: '90-Day Renewal Reminder',
    category: 'renewal',
    description: 'Early renewal notification to start the conversation',
    subject: 'Looking ahead: {{companyName}}\'s Arda renewal in 90 days',
    body: `Hi {{customerName}},

I wanted to give you an early heads up that {{companyName}}'s Arda subscription will be up for renewal in about 90 days ({{renewalDate}}).

Before we get to that date, I'd love to schedule a call to:
• Review the value you've received from Arda this past year
• Discuss any changes to your needs or team size
• Answer questions about your renewal options
• Explore additional features that might benefit you

Your current subscription:
💰 ARR: {{arrValue}} USD
👥 Users: {{totalUsers}}
📅 Renewal Date: {{renewalDate}}

This is also a great time to share feedback:
• What's working well?
• What could be better?
• What would you like to see from Arda going forward?

Would a 30-minute call work in the next week or two? Reply with a few times that work for you.

Looking forward to continuing our partnership!

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'renewalDate', 'arrValue', 'totalUsers', 'csmName', 'csmEmail'],
    suggestedFor: ['renewal_90_days', 'early_renewal', 'annual_review'],
  },
  {
    id: 'renewal-30-days',
    name: '30-Day Renewal Reminder',
    category: 'renewal',
    description: 'One month renewal reminder with urgency',
    subject: 'Action needed: {{companyName}}\'s Arda renewal in 30 days',
    body: `Hi {{customerName}},

Your Arda subscription is coming up for renewal in 30 days ({{renewalDate}}), and I wanted to make sure we're aligned on next steps.

Quick recap of {{companyName}}'s success with Arda:
📊 Health Score: {{healthScore}}/100
👥 {{activeUsers}} active users
📈 Top feature usage: {{topFeature}}

Before renewal, let's:
✓ Confirm your current plan still meets your needs
✓ Discuss any changes to user count or features
✓ Address any outstanding questions or concerns
✓ Ensure a smooth renewal process

Your renewal details:
💰 Current ARR: {{arrValue}} USD
📅 Renewal Date: {{renewalDate}}
👥 Licensed Users: {{totalUsers}}

Can we schedule a brief call this week? I want to make sure you have everything you need and there are no surprises.

Please reply with your availability, or give me a call at {{csmPhone}}.

Best,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'renewalDate', 'healthScore', 'activeUsers', 'topFeature', 'arrValue', 'totalUsers', 'csmName', 'csmEmail', 'csmPhone'],
    suggestedFor: ['renewal_30_days', 'renewal_upcoming', 'contract_renewal'],
  },
  {
    id: 'renewal-confirmation',
    name: 'Renewal Confirmation',
    category: 'renewal',
    description: 'Thank you after successful renewal',
    subject: 'Thank you for renewing, {{companyName}}! 🎉',
    body: `Hi {{customerName}},

I'm thrilled to confirm that {{companyName}} has successfully renewed your Arda subscription! Thank you for your continued partnership.

Your renewed subscription:
📅 New term: Starting {{renewalDate}}
💰 ARR: {{arrValue}} USD
👥 Users: {{totalUsers}}

What's next:
• I'll continue to be your dedicated CSM
• We'll schedule our regular check-ins
• You'll have access to all new features as they launch
• Our support team remains available whenever you need help

Goals for the coming year:
I'd love to set up a quick call to discuss your priorities for the next 12 months. What would you like to achieve with Arda? Let's make a plan together.

Thank you again for choosing Arda. I'm excited about what we'll accomplish together!

Warm regards,
{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'renewalDate', 'arrValue', 'totalUsers', 'csmName', 'csmEmail'],
    suggestedFor: ['renewal_complete', 'contract_renewed', 'retention_success'],
  },

  // ===========================================================================
  // REACTIVATION TEMPLATES
  // ===========================================================================
  {
    id: 'reactivation-we-miss-you',
    name: 'We Miss You',
    category: 'reactivation',
    description: 'Win back churned or dormant customers',
    subject: 'We miss you at {{companyName}}, {{customerName}}!',
    body: `Hi {{customerName}},

It's been a while since we've connected, and I wanted to reach out personally. We miss having {{companyName}} as part of the Arda community!

I've been thinking about your team and wondering:
• How have things been going?
• What challenges are you facing with inventory/operations?
• Is there anything we could have done better?

Since you've been away, we've made some exciting improvements:
✨ [Recent major improvement 1]
✨ [Recent major improvement 2]
✨ [Recent major improvement 3]

Many customers who've returned have told us these changes made a real difference.

I'd genuinely love to hear from you:
• What would it take to consider Arda again?
• Is there a specific issue we could solve for you?
• Would a fresh demo of what's new be helpful?

No pressure, no hard sell. Just a conversation to see if there's a fit.

Coffee chat soon?

{{csmName}}
Customer Success Manager
{{csmEmail}} | {{csmPhone}}`,
    variables: ['customerName', 'companyName', 'csmName', 'csmEmail', 'csmPhone'],
    suggestedFor: ['churned_customer', 'win_back', 'dormant_account'],
  },
  {
    id: 'reactivation-new-features',
    name: 'New Features Announcement',
    category: 'reactivation',
    description: 'Highlight new features to re-engage past customers',
    subject: 'You won\'t believe what\'s new at Arda, {{customerName}}',
    body: `Hi {{customerName}},

I hope this finds you well! I'm reaching out because we've made some significant improvements to Arda since {{companyName}} was last with us, and I immediately thought of your team.

What's new:

🚀 **{{newFeature}}**
   [Brief description of the feature and its benefit]

📊 **Enhanced Analytics**
   Better insights to drive smarter decisions

⚡ **Improved Performance**
   Faster, smoother experience across the board

🔗 **New Integrations**
   Connect with even more tools you use daily

📱 **Mobile Improvements**
   Better on-the-go access for your team

I remember some of the challenges your team faced before. I genuinely believe these updates address many of those concerns.

Would you be open to a 15-minute call to see what's changed? I can give you a personalized tour based on what mattered most to {{companyName}}.

No obligation – just want to show you how far we've come.

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'newFeature', 'csmName', 'csmEmail'],
    suggestedFor: ['reactivation', 'product_update', 'feature_announcement'],
  },
  {
    id: 'reactivation-special-offer',
    name: 'Special Offer',
    category: 'reactivation',
    description: 'Exclusive offer to win back former customers',
    subject: 'An exclusive offer for {{companyName}} to return to Arda',
    body: `Hi {{customerName}},

I wanted to reach out with something special for {{companyName}}.

We'd love to have you back, and I've been authorized to offer you an exclusive returning customer package:

🎁 **Your Special Offer:**
   • {{discountPercent}}% off your first year back
   • Complimentary onboarding and data migration
   • Dedicated training sessions for your team
   • Priority support for the first 90 days

This offer is valid until {{offerExpiry}}.

Why now?
Since you've been away, we've:
✓ Launched powerful new features
✓ Improved platform performance significantly  
✓ Expanded our integration ecosystem
✓ Enhanced our support and success programs

I genuinely believe Arda can help {{companyName}} achieve your goals. This offer is our way of showing we're committed to making it work this time.

Interested in learning more? Just reply to this email or call me at {{csmPhone}}.

Looking forward to welcoming you back!

{{csmName}}
Customer Success Manager
{{csmEmail}}`,
    variables: ['customerName', 'companyName', 'discountPercent', 'offerExpiry', 'csmName', 'csmEmail', 'csmPhone'],
    suggestedFor: ['win_back_offer', 'churned_customer', 'reactivation_campaign'],
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Interpolate template placeholders with actual values.
 * Placeholders are in the format {{placeholderName}}
 */
export function interpolateTemplate(
  template: string,
  placeholders: TemplatePlaceholders
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = placeholders[key as keyof TemplatePlaceholders];
    
    if (value === undefined || value === null) {
      // Return placeholder if value not provided (so user can fill in manually)
      return match;
    }
    
    // Format numbers nicely
    if (typeof value === 'number') {
      if (key === 'arr' || key === 'arrValue') {
        return value.toLocaleString();
      }
      return value.toString();
    }
    
    return String(value);
  });
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): EmailTemplate[] {
  return emailTemplates.filter(t => t.category === category);
}

/**
 * Get templates by suggested alert type or lifecycle stage
 */
export function getTemplatesBySuggestedFor(alertType: string): EmailTemplate[] {
  return emailTemplates.filter(t => 
    t.suggestedFor.some(s => 
      s.toLowerCase().includes(alertType.toLowerCase()) ||
      alertType.toLowerCase().includes(s.toLowerCase())
    )
  );
}

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): EmailTemplate | undefined {
  return emailTemplates.find(t => t.id === id);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): EmailTemplate[] {
  const lowerQuery = query.toLowerCase();
  return emailTemplates.filter(t =>
    t.name.toLowerCase().includes(lowerQuery) ||
    (t.description?.toLowerCase().includes(lowerQuery)) ||
    t.category.toLowerCase().includes(lowerQuery) ||
    t.suggestedFor.some(s => s.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all available categories with labels
 */
export const templateCategories: { value: TemplateCategory; label: string }[] = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'at_risk', label: 'At-Risk Outreach' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'reactivation', label: 'Reactivation' },
];

/**
 * Get all unique variables used across all templates
 */
export function getAllVariables(): string[] {
  const variables = new Set<string>();
  emailTemplates.forEach(t => t.variables.forEach(v => variables.add(v)));
  return Array.from(variables).sort();
}

/**
 * Generate a mailto: URL for the email
 */
export function generateMailtoUrl(
  to: string,
  subject: string,
  body: string
): string {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
}

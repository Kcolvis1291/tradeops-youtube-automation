/**
 * TradeOps Trend Scanner — v2 (Education-First Strategy)
 *
 * Scans for timely HOW-TO content opportunities in the home services industry.
 * Framing: every trend = a "here's how to respond to / take advantage of this" tutorial.
 */

const axios = require('axios');

const INDUSTRY_TOPICS = [
  'GoHighLevel platform updates relevant to service businesses',
  'ServiceTitan, Jobber, or Housecall Pro new features contractors should know',
  'Google Local Services Ads changes affecting home service rankings',
  'AI tools being adopted by trades businesses (scheduling, estimating, customer comms)',
  'Labor costs and technician wage trends affecting contractor pricing',
  'Supply chain and material cost changes impacting job costing',
  'Home services private equity and acquisition activity',
  'New HVAC efficiency regulations (refrigerant changes, efficiency standards)',
  'Changes to contractor licensing requirements by trade',
  'Electric vehicle charger and solar installation demand surge',
  'Interest rate and housing market impact on home improvement demand',
  'Contractor insurance and workers comp rate changes',
  '1099 vs W2 contractor employee classification rules',
  'Google reviews and reputation management algorithm changes',
  'New competition from national home service platforms (Angi, HomeAdvisor, etc.)',
];

/**
 * Scan for trending content opportunities
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
async function scanTrends(apiKey) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const prompt = `You are a content trend analyst for "TradeOps" — an education-first YouTube channel for home service business owners.

Today is ${today}.
Channel strategy: Every video teaches HOW TO implement a system or respond to a change — step by step. Not mindset, not concepts, implementation tutorials.

Identify 5–7 timely content opportunities from these industry areas:
${INDUSTRY_TOPICS.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For each opportunity, frame it as a HOW-TO tutorial topic:

Return JSON: {
  "trends": [
    {
      "topic": "What's happening in the industry",
      "urgency": "Immediate / This Week / This Month / Evergreen",
      "pillar": "One of: job_costing / scheduling_systems / owner_independence / hiring_systems / kpi_tracking / ghl_for_contractors / sop_systems / financial_systems",
      "format": "tutorial or interview",
      "tutorialTitle": "How to [respond to / take advantage of / implement] — specific HOW-TO framing (max 65 chars)",
      "hook": "One punchy sentence that opens the video — the painful truth or bold claim about this trend",
      "implementationAngle": "What specific system or action the viewer will learn to build in this video",
      "urgencyReason": "Why contractors need to know/act on this right now"
    }
  ]
}`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 1600,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
      }
    );
    const text = response.data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return { trends: data.trends || [], scannedAt: new Date().toISOString() };
    }
    return { trends: [], raw: text, scannedAt: new Date().toISOString() };
  } catch (err) {
    console.error('[TrendScanner] Error:', err.message);
    return { trends: getFallbackTrends(), scannedAt: new Date().toISOString(), isFallback: true };
  }
}

function getFallbackTrends() {
  const year = new Date().getFullYear();
  return [
    {
      topic: 'GoHighLevel new automation features for home service businesses',
      urgency: 'This Month',
      pillar: 'ghl_for_contractors',
      format: 'tutorial',
      tutorialTitle: `How to Set Up the New GHL Automations for Contractors (${year})`,
      hook: 'GoHighLevel just released features that can eliminate 80% of your manual follow-up — here\'s how to set them up.',
      implementationAngle: 'Build a full automated follow-up sequence using the newest GHL features',
      urgencyReason: 'Early adopters get competitive advantage in lead conversion',
    },
    {
      topic: 'AI-powered scheduling and dispatch for field service',
      urgency: 'This Month',
      pillar: 'scheduling_systems',
      format: 'tutorial',
      tutorialTitle: 'How to Use AI Scheduling Tools in Your Trades Business',
      hook: 'Contractors using AI scheduling are cutting dispatch time by 60% — here\'s the exact setup.',
      implementationAngle: 'Step-by-step implementation of AI scheduling in a service business',
      urgencyReason: 'Competitors are starting to adopt — operators need to know what\'s available',
    },
    {
      topic: 'Flat rate pricing adoption accelerating across trades',
      urgency: 'Evergreen',
      pillar: 'job_costing',
      format: 'tutorial',
      tutorialTitle: 'How to Switch From T&M to Flat Rate Pricing — Full Setup Guide',
      hook: 'Every contractor still doing time-and-material pricing is leaving money on the table. Here\'s how to switch.',
      implementationAngle: 'Full flat rate pricing system: calculation, book creation, customer communication',
      urgencyReason: 'Operators switching to flat rate consistently report 20-30% margin improvement',
    },
    {
      topic: 'Technician shortage pushing contractors to improve retention systems',
      urgency: 'Evergreen',
      pillar: 'hiring_systems',
      format: 'tutorial',
      tutorialTitle: 'How to Build a Technician Retention System That Actually Works',
      hook: 'The technician shortage isn\'e not going away — the contractors who win are the ones who built retention systems before they needed them.',
      implementationAngle: 'Build a complete retention system: compensation structure, career path, culture plays',
      urgencyReason: 'Losing one tech costs $15K-30K in replacement — retention ROI is immediate',
    },
  ];
}

module.exports = { scanTrends };

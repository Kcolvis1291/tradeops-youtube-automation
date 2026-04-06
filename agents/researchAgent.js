/**
 * TradeOps Research Agent — v2 (Education-First Strategy)
 *
 * COMPETITIVE POSITIONING:
 *   Profitable Tradie  → Mindset + concepts. Podcast-first. Lacks step-by-step HOW-TO.
 *   Profit for Contractors → Financials + coaching. No operational workflows, no tech guides.
 *   ServiceTitan YT   → Product demos only. Zero business education.
 *
 * TradeOps OWNS: "Here's exactly HOW to build the system — step by step."
 *   Every video teaches trades business owners to implement a real system themselves.
 *   CTA: "Want this done FOR you instead? Visit tradeops.com"
 *
 * Audience: Home service business owners ($500K–$5M): plumbers, electricians, HVAC,
 *           roofers, landscapers, painters, GCs.
 */

const axios = require('axios');

// ── Education-First Content Pillars ──────────────────────────────────────────
// Each pillar is framed as "How to..." — implementation, not concepts
const CHANNEL = {
  name: 'TradeOps',
  positioning: 'The step-by-step implementation channel for trades business owners. Not mindset. Not coaching. Actual systems you can build this week.',
  competitorGaps: [
    'Profitable Tradie teaches WHY to systemize — TradeOps teaches HOW, step by step',
    'Profit for Contractors covers financial concepts — TradeOps shows exact workflows and templates',
    'ServiceTitan only teaches their own software — TradeOps teaches software-agnostic systems',
    'Nobody in the space produces HOW-TO implementation content with specific checklists and templates',
  ],
  pillars: {
    'job_costing': {
      educationFrame: 'How to Set Up Job Costing in Your Trades Business',
      topics: [
        'how to set up job costing from scratch',
        'how to calculate true cost per job',
        'how to build a job costing spreadsheet',
        'how to track labor cost vs estimate',
        'how to calculate overhead per job',
        'how to know if you\'re making money on every job',
        'how to switch from T&M to flat rate pricing',
        'how to price a service call profitably',
      ],
      keywords: ['job costing contractors', 'how to price jobs contractor', 'flat rate pricing setup', 'contractor profit margins', 'overhead calculation trades', 'labor burden rate'],
      competitorGap: 'Profit for Contractors explains profit concepts — TradeOps shows the exact spreadsheet and formula setup',
      searchIntent: 'Implementation — operator wants to build the system, not just understand it',
    },
    'scheduling_systems': {
      educationFrame: 'How to Build a Scheduling System That Runs Without You',
      topics: [
        'how to set up a dispatch board for your trades company',
        'how to build a crew scheduling system',
        'how to eliminate scheduling chaos in service business',
        'how to set up recurring maintenance scheduling',
        'how to optimize route density for field techs',
        'how to build a booking system for home services',
        'how to use Jobber for scheduling step by step',
        'how to use ServiceTitan scheduling features',
      ],
      keywords: ['contractor scheduling system', 'dispatch board setup', 'crew scheduling software', 'field service scheduling', 'how to schedule service calls'],
      competitorGap: 'Nobody teaches HOW to configure and use these systems — only that you need them',
      searchIntent: 'How-to implementation — contractor is overwhelmed with scheduling chaos',
    },
    'owner_independence': {
      educationFrame: 'How to Eliminate Owner Dependency — Step by Step',
      topics: [
        'how to get yourself out of the field as a contractor',
        'how to document every job role in your business',
        'how to build a business that runs without you',
        'how to hire and train your first field supervisor',
        'how to delegate jobs without losing quality control',
        'how to build an org chart for a trades company',
        'how to create a daily operations checklist for your team',
        'how to stop being the bottleneck in your own business',
      ],
      keywords: ['owner operator to CEO contractor', 'get out of the field', 'delegate trades business', 'contractor stops working in business', 'systemize contracting company'],
      competitorGap: 'Both competitors address this conceptually — no one shows the exact delegation workflow and role documentation',
      searchIntent: 'Tactical — owner is stuck working IN the business and wants a roadmap out',
    },
    'hiring_systems': {
      educationFrame: 'How to Systemize Your Hiring Process for Trades',
      topics: [
        'how to write a job posting that attracts quality technicians',
        'how to build a hiring funnel for a trades company',
        'how to interview and screen service technicians',
        'how to onboard a new technician in 30 days',
        'how to build a technician training program',
        'how to create a culture that retains field staff',
        'how to pay technicians — flat rate vs hourly vs commission',
        'how to build an apprenticeship program for your company',
      ],
      keywords: ['hiring technicians trades', 'contractor hiring system', 'how to hire plumber electrician HVAC', 'technician onboarding process', 'trades employee retention'],
      competitorGap: 'Profitable Tradie covers hiring mindset — TradeOps shows the full funnel: posting, screening, onboarding, retention system',
      searchIntent: 'Operator is actively hiring or has high turnover and needs a repeatable system',
    },
    'kpi_tracking': {
      educationFrame: 'How to Track KPIs in Your Trades Business',
      topics: [
        'how to set up a KPI dashboard for a service company',
        'what KPIs every trades business should track',
        'how to track revenue per technician per day',
        'how to measure job conversion rate for contractors',
        'how to track average ticket value in home services',
        'how to build a weekly scorecard for your field team',
        'how to use data to find profit leaks in your business',
        'how to run a weekly numbers meeting with your team',
      ],
      keywords: ['contractor KPIs', 'service business metrics', 'revenue per technician', 'average ticket value trades', 'field service KPI dashboard', 'contractor scorecard'],
      competitorGap: 'Nobody in the space teaches what to track AND how to build the actual tracking system',
      searchIntent: 'Owner knows they should track numbers but has no system — wants a step-by-step setup',
    },
    'ghl_for_contractors': {
      educationFrame: 'How to Set Up GoHighLevel for Your Trades Business',
      topics: [
        'how to set up GoHighLevel for a home service company',
        'how to build a lead follow-up automation in GHL',
        'how to build a contractor CRM pipeline in GoHighLevel',
        'how to automate review requests with GoHighLevel',
        'how to set up missed call text back for contractors',
        'how to build an estimate follow-up sequence in GHL',
        'how to use GHL calendar for service bookings',
        'GoHighLevel vs ServiceTitan for contractors',
      ],
      keywords: ['GoHighLevel for contractors', 'GHL home service business', 'contractor CRM setup', 'GHL automation trades', 'missed call text back contractor'],
      competitorGap: 'ServiceTitan only teaches their own product — nobody teaches GHL for contractors at the implementation level',
      searchIntent: 'High intent — contractor is considering or already has GHL and wants to implement it properly',
    },
    'sop_systems': {
      educationFrame: 'How to Build SOPs for Your Trades Business',
      topics: [
        'how to write SOPs for a service company',
        'how to document every process in your trades business',
        'how to create a job quality checklist for technicians',
        'how to build a customer communication SOP',
        'how to create an estimating SOP for contractors',
        'how to document your service call process step by step',
        'how to use Loom or video to document SOPs',
        'how to onboard new hires with SOPs',
      ],
      keywords: ['SOPs for contractors', 'standard operating procedures trades', 'document business processes contractor', 'how to build systems service company', 'process documentation trades'],
      competitorGap: 'Competitors mention SOPs but never show how to actually write and implement one',
      searchIntent: 'Implementation — operator wants to stop reinventing the wheel for every job',
    },
    'financial_systems': {
      educationFrame: 'How to Build Financial Systems for a Trades Business',
      topics: [
        'how to set up bookkeeping for a contractor',
        'how to manage cash flow in a service business',
        'how to build a budget for a trades company',
        'how to read a P&L as a contractor',
        'how to calculate your real overhead rate',
        'how to set up payroll for a service company',
        'how to build a cash flow forecast for contractors',
        'how to separate personal and business finances as a contractor',
      ],
      keywords: ['contractor bookkeeping setup', 'cash flow management contractors', 'trades business budget', 'contractor P&L', 'overhead rate calculation'],
      competitorGap: 'Profit for Contractors explains financial concepts — TradeOps shows how to set up the actual systems in QuickBooks/Wave/etc.',
      searchIntent: 'Operator is financially disorganized and wants a setup they can follow',
    },
  },
};

// ── Evergreen Title Formulas (proven for education-first B2B content) ──────────
const EDUCATION_TITLE_FORMULAS = [
  'How to [SYSTEM] — Step by Step for Contractors',
  'How I Built a [SYSTEM] for My [Trade] Business (Full Walkthrough)',
  'The [SYSTEM] Every Trades Business Needs (And How to Build It)',
  'How to [OUTCOME] Without [Pain Point]',
  'Set Up [SYSTEM] in [Time Frame] — Contractor Tutorial',
  '[NUMBER] Steps to Build a [SYSTEM] for Your [Trade] Company',
  'How to [TASK] Like a $[Revenue] Contractor',
  'Why Your [Problem] Is Costing You [Amount] — And How to Fix It',
  'Build This [SYSTEM] Once, Use It Forever',
  'The [SYSTEM] Tutorial No One in the Trades Industry Has Made (Until Now)',
];

/**
 * Generate research brief
 * @param {string} pillar - content pillar key or 'all'
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
async function runResearch(pillar = 'all', apiKey) {
  const year = new Date().getFullYear();

  let selectedPillar = pillar;
  if (pillar === 'all' || pillar === 'TradeOps') {
    const pillars = Object.keys(CHANNEL.pillars);
    selectedPillar = pillars[Math.floor(Math.random() * pillars.length)];
  }

  const pillarData = CHANNEL.pillars[selectedPillar] || CHANNEL.pillars['job_costing'];
  const prompt = buildResearchPrompt(selectedPillar, pillarData, year);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 2000,
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
    return parseResearchResponse(text, selectedPillar, pillarData);
  } catch (err) {
    console.error('[ResearchAgent] API error:', err.message);
    return getFallbackResearch(selectedPillar, pillarData, year);
  }
}

function buildResearchPrompt(pillar, pillarData, year) {
  return `You are a YouTube content research specialist for "TradeOps" — an education-first B2B channel for home service business owners (plumbers, electricians, HVAC, roofers, landscapers, painters, GCs).

TRADEOPS CONTENT STRATEGY:
- Every video teaches HOW TO implement a specific system — step by step
- NOT mindset, NOT coaching philosophy — actual build-it-yourself tutorials
- Competitor gap we exploit: Profitable Tradie and Profit for Contractors teach concepts. TradeOps teaches implementation.
- CTA is always: "Want this done FOR you? Visit tradeops.com" (done-for-you positioning)

CONTENT PILLAR: ${pillar.replace(/_/g, ' ').toUpperCase()}
Education frame: "${pillarData.educationFrame}"
Topics in this pillar: ${pillarData.topics.join(', ')}
Target keywords: ${pillarData.keywords.join(', ')}
Competitor gap we fill: ${pillarData.competitorGap}
Search intent: ${pillarData.searchIntent}

Generate a research brief for ${year}. Return JSON with:
{
  "topTopics": [
    {
      "title": "YouTube title using 'How to...' framing (max 65 chars)",
      "searchVolume": "High/Medium/Low",
      "implementationAngle": "What specific system/process the viewer will BUILD by end of video",
      "competitorGap": "What Profitable Tradie/Profit for Contractors doesn't cover that this fills",
      "hookStatement": "One punchy sentence that opens the video — a painful truth or bold claim",
      "deliverable": "The tangible thing viewers walk away with (checklist, template, workflow, etc.)"
    }
  ] (5 topics),
  "evergreenTitles": ["3 evergreen title options using proven formulas"],
  "trendingAngles": ["3 timely angles relevant to the home services industry right now"],
  "recommendedVideo": {
    "title": "Best single video to make first for this pillar",
    "hook": "Opening line of the video",
    "outline": ["5-7 section headers showing the step-by-step structure"],
    "deliverable": "What the viewer builds or walks away with",
    "whyFirst": "Why this specific video should anchor the pillar"
  }
}`;
}

function parseResearchResponse(text, pillar, pillarData) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        channel: 'TradeOps',
        pillar,
        educationFrame: pillarData.educationFrame,
        competitorGap: pillarData.competitorGap,
        ...data,
        generatedAt: new Date().toISOString(),
      };
    }
  } catch (e) { /* fall through */ }
  return { channel: 'TradeOps', pillar, raw: text, generatedAt: new Date().toISOString() };
}

function getFallbackResearch(pillar, pillarData, year) {
  const topics = pillarData.topics.slice(0, 5).map((t, i) => ({
    title: t.charAt(0).toUpperCase() + t.slice(1),
    searchVolume: i < 2 ? 'High' : 'Medium',
    implementationAngle: `Full walkthrough: build this ${t.replace('how to ', '')} from scratch`,
    competitorGap: pillarData.competitorGap,
    hookStatement: `Most contractors struggle with this their entire career because nobody ever showed them how to build the system.`,
    deliverable: 'Step-by-step checklist + template they can use this week',
  }));

  return {
    channel: 'TradeOps',
    pillar,
    educationFrame: pillarData.educationFrame,
    competitorGap: pillarData.competitorGap,
    topTopics: topics,
    evergreenTitles: [
      `${pillarData.educationFrame} (${year})`,
      `The ${pillar.replace(/_/g, ' ')} System Every Trades Business Needs`,
      `How to Build a ${pillar.replace(/_/g, ' ')} From Scratch — Step by Step`,
    ],
    trendingAngles: pillarData.topics.slice(0, 3).map(t => `${t} in ${year}`),
    recommendedVideo: {
      title: pillarData.educationFrame,
      hook: `Most contractors struggle with this their entire career because nobody ever showed them how to actually build the system.`,
      outline: [
        'Why most contractors get this wrong',
        'What the finished system looks like',
        'Step 1: The foundation',
        'Step 2: Build the workflow',
        'Step 3: Set up the tools',
        'Step 4: Train your team on it',
        'How to maintain it going forward',
      ],
      deliverable: 'Complete system template + step-by-step checklist',
      whyFirst: 'Highest search volume and clearest pain point for this pillar',
    },
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}

module.exports = { runResearch, CHANNEL };

/**
 * TradeOps SEO Agent — v2 (Education-First Strategy)
 *
 * DESCRIPTION TEMPLATE:
 *   - Opens with keyword-rich summary of what the viewer learns to BUILD
 *   - Includes free implementation guide download offer
 *   - Done-for-you CTA: "Want this built FOR you? Visit tradeops.com"
 *   - Watch Next link baked in
 *   - No "book a systems audit" — that's gone
 *
 * TITLE STRATEGY:
 *   Lead with "How to..." or outcome-first titles.
 *   Beat competitors by being more specific and implementation-focused.
 */

const axios = require('axios');

const CHANNEL_META = {
  name: 'TradeOps',
  brandTags: '#TradeOps #ContractorBusiness #TradesBusiness',
  category: 'Education',
  defaultTags: [
    'contractor business systems',
    'how to systemize trades business',
    'trades business owner',
    'home service business',
    'contractor operations',
    'service business systems',
    'plumbing business tips',
    'HVAC business owner',
    'electrical contractor business',
    'contractor how to',
  ],
};

// Description template — education-first, done-for-you CTA
const DESCRIPTION_TEMPLATE = `{VIDEO_SUMMARY}

📥 FREE IMPLEMENTATION GUIDE: Download the checklist/template from this video
→ {RESOURCE_LINK}

━━━━━━━━━━━━━━━━━━━━━━━
⏱️ CHAPTERS
{TIMESTAMPS}

📋 IN THIS VIDEO YOU'LL BUILD
{KEY_POINTS}

━━━━━━━━━━━━━━━━━━━━━━━
🔧 WANT THIS DONE FOR YOU?
If you'd rather have TradeOps implement this in your business instead of building it yourself — that's exactly what we do.
→ Visit tradeops.com to see how it works
━━━━━━━━━━━━━━━━━━━━━━━

📺 WATCH NEXT
→ {RELATED_VIDEO_TITLE}: {RELATED_VIDEO_URL}

🔔 NEW SYSTEMS TUTORIAL EVERY WEEK → Subscribe so you don't miss it

📲 FOLLOW TRADEOPS
→ Website: https://tradeops.com
→ Instagram: https://instagram.com/tradeops

━━━━━━━━━━━━━━━━━━━━━━━
{DISCLAIMER}
━━━━━━━━━━━━━━━━━━━━━━━

{HASHTAGS}`;

// Pillar-specific tag banks — each scoped to the HOW-TO intent
const PILLARS_TAG_BANK = {
  job_costing: ['how to do job costing contractors', 'job costing tutorial', 'flat rate pricing setup', 'contractor profit margins', 'how to price jobs', 'overhead calculation', 'job cost tracking'],
  scheduling_systems: ['how to schedule service calls', 'dispatch board contractor', 'crew scheduling system', 'field service scheduling tutorial', 'contractor scheduling software setup'],
  owner_independence: ['how to get out of the field contractor', 'owner operator to CEO', 'eliminate owner dependency', 'build self-managing trades business', 'contractor delegation system'],
  hiring_systems: ['how to hire technicians', 'contractor hiring process', 'trades employee onboarding', 'hiring system service company', 'how to find good tradespeople'],
  kpi_tracking: ['contractor KPIs how to', 'service business metrics', 'revenue per technician', 'KPI dashboard trades', 'how to track contractor numbers', 'average ticket value'],
  ghl_for_contractors: ['GoHighLevel contractor tutorial', 'GHL home service setup', 'contractor CRM how to', 'GoHighLevel automation trades', 'missed call text back setup'],
  sop_systems: ['how to write SOPs contractors', 'standard operating procedures trades', 'document business processes', 'contractor SOP template', 'process documentation service company'],
  financial_systems: ['contractor bookkeeping setup', 'cash flow management trades', 'contractor P&L tutorial', 'overhead rate calculation', 'trades business budget'],
};

// Related video suggestions per pillar
const RELATED_VIDEOS = {
  job_costing: 'How to Calculate Your Real Overhead Rate as a Contractor',
  scheduling_systems: 'How to Build a Dispatch System That Runs Without You',
  owner_independence: 'How to Document Every Role in Your Trades Business',
  hiring_systems: 'How to Onboard a New Technician in 30 Days',
  kpi_tracking: 'How to Run a Weekly Numbers Meeting With Your Field Team',
  ghl_for_contractors: 'How to Build an Automated Follow-Up Sequence in GoHighLevel',
  sop_systems: 'How to Train New Employees Using SOPs and Loom Videos',
  financial_systems: 'How to Set Up Bookkeeping for a Trades Business (QuickBooks Tutorial)',
};

/**
 * Generate SEO metadata package
 * @param {Object} params
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
async function generateSEO(params, apiKey) {
  const {
    topic,
    pillar = 'job_costing',
    format = 'tutorial',
    script = '',
    guestName = null,
    relatedVideoTitle = null,
  } = params;

  const pillarTags = PILLARS_TAG_BANK[pillar] || [];
  const isInterview = format === 'interview';
  const relatedTitle = relatedVideoTitle || RELATED_VIDEOS[pillar] || 'How to Systemize Your Trades Business';
  const prompt = buildSEOPrompt(topic, pillar, format, script, guestName, relatedTitle, isInterview);

  let seoData;
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1800,
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
    seoData = jsonMatch ? JSON.parse(jsonMatch[0]) : getFallbackSEO(topic, pillar, format, guestName);
  } catch (err) {
    console.error('[SEOAgent] Error:', err.message);
    seoData = getFallbackSEO(topic, pillar, format, guestName);
  }

  const disclaimer = 'Results discussed are illustrative examples. Individual business outcomes vary based on market, team, and execution. Nothing in this video constitutes legal, financial, or business consulting advice.';
  const resourceLink = `https://tradeops.com/resources/${pillar.replace(/_/g, '-')}`;
  const featuredBlock = isInterview && guestName ? guestName : 'TradeOps — Systems implementation for home service businesses';

  const fullDescription = DESCRIPTION_TEMPLATE
    .replace('{VIDEO_SUMMARY}', seoData.summary || '')
    .replace('{RESOURCE_LINK}', resourceLink)
    .replace('{TIMESTAMPS}', (seoData.chapterTimestamps || []).join('\n'))
    .replace('{KEY_POINTS}', (seoData.keyPoints || []).map(p => `→ ${p}`).join('\n'))
    .replace('{RELATED_VIDEO_TITLE}', relatedTitle)
    .replace('{RELATED_VIDEO_URL}', 'https://youtube.com/@TradeOps')
    .replace('{DISCLAIMER}', disclaimer)
    .replace('{HASHTAGS}', [CHANNEL_META.brandTags, ...(seoData.hashtags || [])].join(' '));

  const allTags = [...new Set([...(seoData.tags || []), ...pillarTags, ...CHANNEL_META.defaultTags])].slice(0, 15);

  return {
    ...seoData,
    description: fullDescription,
    tags: allTags,
    channel: 'TradeOps',
    pillar,
    format,
    resourceLink,
    generatedAt: new Date().toISOString(),
  };
}

function buildSEOPrompt(topic, pillar, format, script, guestName, relatedTitle, isInterview) {
  const scriptSnippet = script ? script.substring(0, 1000) : '';
  const formatNote = isInterview && guestName
    ? `INTERVIEW format. Guest: ${guestName}. Include guest name in title if it fits and adds credibility.`
    : `${format.toUpperCase()} format — host-driven tutorial or breakdown.`;

  return `You are a YouTube SEO specialist for "TradeOps" — an education-first B2B channel teaching trades business owners HOW TO implement specific systems.

FORMAT: ${formatNote}
TOPIC: ${topic}
PILLAR: ${pillar.replace(/_/g, ' ')}
SCRIPT SNIPPET: ${scriptSnippet}

The audience searches HOW-TO queries: "how to set up job costing contractors", "how to schedule service calls", "GoHighLevel contractor tutorial", etc. Title should match this intent.

Return JSON with ONLY these keys:
{
  "title": "YouTube title — lead with 'How to...' where natural. Max 65 chars. Specific and implementation-focused. Primary keyword near front.",
  "titleAlternatives": ["2 alternative titles — one outcome-focused, one problem-focused"],
  "summary": "First 150 chars of description. Keyword-rich. Describes WHAT the viewer will build or implement. Starts strong.",
  "keyPoints": ["5–6 bullet points of what the viewer will BUILD or LEARN TO DO in this video — implementation language"],
  "tags": ["10 specific tags — mostly how-to intent, trades-specific, mix broad and long-tail"],
  "hashtags": ["3–4 relevant hashtags beyond brand tags"],
  "thumbnailText": "Short text for thumbnail overlay (max 4 words, implementation-focused — e.g. 'JOB COSTING SETUP' or 'HIRE RIGHT')",
  "chapterTimestamps": ["0:00 Hook", "0:45 ...", "continue for 6–9 chapters matching the HOW-TO structure"],
  "pinnedComment": "Engaging pinned comment — ask a specific implementation question to drive comments (e.g. 'Which step are you implementing first?')",
  "endScreenCTA": "Short overlay text for end screen — 5 words max"
}`;
}

function getFallbackSEO(topic, pillar, format, guestName) {
  const year = new Date().getFullYear();
  const isInterview = format === 'interview';
  const titleBase = isInterview && guestName
    ? `${guestName}: How I Built This System`
    : topic.charAt(0).toUpperCase() + topic.slice(1);

  return {
    title: titleBase.substring(0, 65),
    titleAlternatives: [
      `The ${pillar.replace(/_/g, ' ')} System That Changes Your Business`,
      `Stop Winging It: ${topic} — Step by Step`,
    ],
    summary: `Step-by-step tutorial: ${topic}. By the end of this video you'll have a working system you can implement in your trades business this week.`,
    keyPoints: [
      `Exactly how to set up ${topic} from scratch`,
      'The tools and templates you need',
      'Step-by-step walkthrough you can follow along',
      'Common mistakes that cost contractors money',
      'One thing you can implement today',
    ],
    tags: PILLARS_TAG_BANK[pillar] || CHANNEL_META.defaultTags.slice(0, 10),
    hashtags: ['#ContractorBusiness', '#TradesBusiness', '#HomeServiceBusiness'],
    thumbnailText: topic.split(' ').slice(0, 3).join(' ').toUpperCase().substring(0, 25),
    chapterTimestamps: [
      '0:00 Hook',
      '0:45 What You\'ll Build',
      '1:30 Why This Matters',
      '3:00 Step 1',
      '5:30 Step 2',
      '8:00 Step 3',
      '10:30 Common Mistakes',
      '12:00 Your Action Steps',
      '13:00 Done-for-You Option',
    ],
    pinnedComment: `Which step from this video are you implementing first in your business? Drop it below — I read every comment. 👇`,
    endScreenCTA: 'Watch This Next',
  };
}

module.exports = { generateSEO, CHANNEL_META, DESCRIPTION_TEMPLATE, RELATED_VIDEOS };

/**
 * TradeOps Thumbnail Agent — v2 (Education-First Strategy)
 *
 * Thumbnail strategy: Lead with the OUTCOME or the SYSTEM being taught.
 * "HOW TO" framing in the overlay text beats curiosity bait for B2B how-to content.
 * Competitor benchmarking: Profitable Tradie uses talking-head thumbnails.
 * TradeOps differentiates with system/result-focused overlays + host credibility.
 */

const axios = require('axios');

const THUMBNAIL_TEMPLATE = {
  colorScheme: 'Deep charcoal (#1A1A1A) + TradeOps Orange (#F05A28) + White (#FFFFFF)',
  fontStyle: 'Montserrat ExtraBold or Impact — heavy, bold, readable at small size',
  logoPlacement: 'Bottom right — "TradeOps" wordmark in orange',
  bgStyle: 'Dark background (solid or construction/job site photo). No busy/cluttered backgrounds.',
  overlayStyle: 'Large bold text left-aligned OR full-width bar at bottom. Orange accent elements.',
  hostPresence: 'Tutorial/Breakdown: Host in frame, serious and direct. Interview: Host left + guest right.',
  emotionTargets: ['competence/authority', 'implementation urgency', 'peer credibility', 'curiosity gap'],
  titleStrategy: 'Lead with the SYSTEM NAME or the HOW-TO outcome — not clickbait. "JOB COSTING SETUP" beats "THIS CHANGED EVERYTHING".',
};

const FORMAT_NOTES = {
  tutorial: 'Host in thumbnail looking at camera — confident, direct. Bold system/tool name overlay. Optional: screenshot of a template or tool interface in background.',
  interview: 'Host left, guest right. Guest\'s business credential prominently overlaid (e.g., "$2M HVAC Owner"). Both looking at camera.',
  breakdown: 'Host in thumbnail with a diagram, chart, or comparison visual. Text overlay names the concept being broken down.',
};

const PILLAR_VISUAL_CUES = {
  job_costing: 'Spreadsheet/calculator visual, dollar sign, profit margin stat',
  scheduling_systems: 'Calendar grid, dispatch board, clock icon',
  owner_independence: 'Org chart, arrows pointing away from owner, "OUT OF THE FIELD" text',
  hiring_systems: 'Handshake, resume, team silhouette, hiring funnel',
  kpi_tracking: 'Dashboard screenshot, upward graph, KPI numbers',
  ghl_for_contractors: 'GHL interface screenshot, automation arrows, "AUTOMATED" badge',
  sop_systems: 'Checklist, documented process flow, clipboard',
  financial_systems: 'P&L sheet, QuickBooks screenshot, cash flow graph',
};

/**
 * @param {Object} params - { topic, title, pillar, format, guestName, guestCredential }
 * @param {string} apiKey
 */
async function generateThumbnails(params, apiKey) {
  const {
    topic,
    title,
    pillar = 'job_costing',
    format = 'tutorial',
    guestName = null,
    guestCredential = null,
  } = params;

  const isInterview = format === 'interview';
  const formatNote = FORMAT_NOTES[format] || FORMAT_NOTES.tutorial;
  const visualCue = PILLAR_VISUAL_CUES[pillar] || 'System diagram or workflow visual';

  const prompt = `You are a YouTube thumbnail designer for "TradeOps" — an education-first B2B channel for trades business owners.

VIDEO TITLE: ${title}
TOPIC: ${topic}
FORMAT: ${format.toUpperCase()}
PILLAR: ${pillar.replace(/_/g, ' ')}
${isInterview ? `GUEST: ${guestName || '[Guest Name]'} (${guestCredential || 'Trades Business Owner'})` : ''}

BRAND STYLE:
${JSON.stringify(THUMBNAIL_TEMPLATE, null, 2)}

FORMAT GUIDANCE: ${formatNote}
PILLAR VISUAL CUE: ${visualCue}

THUMBNAIL STRATEGY: Lead with the SYSTEM or OUTCOME being taught. The text overlay should communicate "here's what you'll learn to build" — not vague curiosity bait. The viewer should know EXACTLY what this video teaches from the thumbnail alone.

Create 2 A/B thumbnail concepts. Return JSON:
{
  "conceptA": {
    "concept": "One sentence describing the full visual composition",
    "mainText": "Primary overlay text (max 4 words, ALL CAPS — names the system or outcome)",
    "subText": "Secondary line (optional, max 6 words, adds context or specificity)",
    "backgroundStyle": "Describe background",
    "hostPosition": "${isInterview ? 'Host left, guest right, both to camera' : 'Host position and expression'}",
    "accentElements": "Any icons, tools, screenshots, or design elements that reinforce the how-to angle",
    "emotionTarget": "Specific emotion/reaction this triggers in a contractor browsing YouTube",
    "canvaInstructions": ["Step 1...", "...up to 10 steps with specific fonts, colors (#F05A28 orange, #1A1A1A dark), sizes"]
  },
  "conceptB": { ...same structure... },
  "abTestingNote": "Which to test first and what CTR mechanic each tests — be specific"
}`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1400,
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
      return { ...JSON.parse(jsonMatch[0]), channel: 'TradeOps', topic, format, generatedAt: new Date().toISOString() };
    }
  } catch (err) {
    console.error('[ThumbnailAgent] Error:', err.message);
  }
  return getFallbackThumbnails(topic, title, pillar, format, guestName, guestCredential);
}

function getFallbackThumbnails(topic, title, pillar, format, guestName, guestCredential) {
  const isInterview = format === 'interview';
  const systemName = topic.replace(/^how to /i, '').split(' ').slice(0, 4).join(' ').toUpperCase();

  return {
    channel: 'TradeOps',
    topic, format,
    conceptA: {
      concept: isInterview
        ? `Host and guest side-by-side on dark bg, guest credential overlaid in orange bar at bottom, system name in white above`
        : `Host facing camera on dark bg, bold system/outcome text overlay left, optional tool/template screenshot background element`,
      mainText: systemName.substring(0, 20),
      subText: isInterview ? (guestCredential || 'Trades Business Owner') : 'STEP BY STEP',
      backgroundStyle: 'Solid #1A1A1A charcoal background',
      hostPosition: isInterview ? 'Host left, guest right, both direct eye contact' : 'Host right side, direct to camera, confident expression',
      accentElements: `Orange horizontal accent bar, TradeOps wordmark bottom right. ${PILLAR_VISUAL_CUES[pillar] || ''}`,
      emotionTarget: 'Competence signal — "this person knows exactly how to do this"',
      canvaInstructions: [
        'Canva → YouTube Thumbnail (1280×720)',
        'Background: solid #1A1A1A',
        'Add host photo, remove background, position right side of frame',
        `Main text left: "${systemName}" — Montserrat ExtraBold, 100pt, white`,
        'Sub-text below: "STEP BY STEP" — 42pt, #F05A28 orange',
        'Orange horizontal line accent 4px between main and sub text',
        'TradeOps wordmark bottom right, 28pt, orange',
        'Export PNG',
      ],
    },
    conceptB: {
      concept: 'Split design — left side shows a tool/template screenshot or stat, right side shows host. Text overlay bridges both halves.',
      mainText: 'BUILD THIS',
      subText: topic.replace(/^how to /i, '').split(' ').slice(0, 4).join(' '),
      backgroundStyle: 'Left third: dark gradient. Right two-thirds: host photo.',
      hostPosition: isInterview ? 'Both host and guest cropped to shoulder height, left of center' : 'Host occupying right 60% of frame',
      accentElements: 'Orange left panel, tool icon or dollar amount stat in orange panel',
      emotionTarget: 'Action urgency — "I need to build this in my business"',
      canvaInstructions: [
        'Canva → YouTube Thumbnail (1280×720)',
        'Add dark charcoal background full canvas',
        'Add orange rectangle left 35% of canvas (#F05A28)',
        'Add large icon or stat in the orange panel — white, 150pt',
        'Add host photo right 65%, remove background',
        'Text overlay across both: topic name, Montserrat ExtraBold 72pt, white',
        'Thin white dividing line between panels',
        'TradeOps logo bottom right',
        'Export PNG',
      ],
    },
    abTestingNote: 'Test Concept A first (system name + authority positioning). If CTR < 4% after 5 days, switch to Concept B (action urgency). B2B how-to viewers respond well to explicit system/outcome naming.',
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateThumbnails, THUMBNAIL_TEMPLATE, PILLAR_VISUAL_CUES };

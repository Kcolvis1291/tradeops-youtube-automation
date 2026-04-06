/**
 * TradeOps Engage Agent — v2 (Education-First Strategy)
 * Comment responses in the host's peer-to-peer voice.
 * High-intent questions get done-for-you CTA woven in naturally.
 */

const axios = require('axios');

const VOICE_PROFILE = {
  persona: 'TradeOps host — former contractor, built a 7-figure operation by actually implementing the systems. Responds to comments like a peer, not a brand account.',
  tone: 'Direct, helpful, specific. Uses industry language. Answers the actual question before anything else.',
  neverSay: ['guaranteed results', 'you will definitely', 'DM me to buy', 'book a free systems audit', 'systems audit'],
  alwaysDo: [
    'Answer the specific question in 2–3 sentences max',
    'Name specific tools when relevant',
    'Point complex implementation questions to tradeops.com (done-for-you)',
    'Ask a follow-up question to drive continued engagement',
  ],
  cta: 'Visit tradeops.com — done-for-you positioning only. NOT "book a systems audit."',
};

function detectIntent(comment) {
  const lower = comment.toLowerCase();
  if (/http|www\.|\.com|follow me|check out my|buy now|promo/i.test(comment)) return 'spam';
  if (/\?/.test(comment) && /how|what|which|where|step|setup|configure|build|implement/i.test(lower)) return 'implementation_question';
  if (/\?/.test(comment) && /software|tool|app|platform|ghl|servicetitan|jobber|quickbooks/i.test(lower)) return 'tool_question';
  if (/worked|helped|tried|implemented|did this|built this|thank/i.test(lower)) return 'success_share';
  if (/won't work|doesn't work|not realistic|my market|my trade|too small|too large/i.test(lower)) return 'skepticism';
  if (/can you make|video on|cover|next video|tutorial on/i.test(lower)) return 'content_request';
  if (/wrong|bad|disagree|not helpful|missing|forgot/i.test(lower)) return 'pushback';
  return 'general';
}

async function generateCommentResponse(params, apiKey) {
  const { comment, videoTopic, pillar = 'job_costing' } = params;
  const intent = detectIntent(comment);

  if (intent === 'spam') {
    return { response: null, intent, flagged: true, action: 'HIDE' };
  }

  const shouldIncludeDFYCta = ['implementation_question', 'tool_question'].includes(intent);
  const prompt = buildResponsePrompt(comment, videoTopic, pillar, intent, shouldIncludeDFYCta);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
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
    return { response: text.trim(), intent, flagged: false, includesDFYCta: shouldIncludeDFYCta };
  } catch (err) {
    return { response: getFallbackResponse(intent, videoTopic), intent, flagged: false };
  }
}

function buildResponsePrompt(comment, videoTopic, pillar, intent, includeDFYCta) {
  const ctaNote = includeDFYCta
    ? 'If the question is complex or would take significant time to implement, naturally mention that TradeOps builds this for businesses — visit tradeops.com to see how that works" — done-for-you positioning only. Do NOT say "book a systems audit."'
    : 'Do NOT include any CTA — just answer helpfully.';

  return `You are the TradeOps host responding to a YouTube comment. Former contractor, built a 7-figure trades operation. You respond like a peer — direct, practical, no fluff.

VIDEO TOPIC: ${videoTopic}
PILLAR: ${pillar.replace(/_/g, ' ')}
COMMENT INTENT: ${intent.replace(/_/g, ' ')}
COMMENT: "${comment}"

RULES:
- Answer the actual question first — don't dodge it
- Max 3–4 sentences unless genuinely complex
- Use specific tool names when relevant
- ${ctaNote}
- Never say "great question" or start with a compliment
- Write ONLY the response — no labels, no quotes`;
}

function getFallbackResponse(intent, videoTopic) {
  const responses = {
    implementation_question: `Short answer: yes, you can set this up this week. Start with step 1 from the video, get that working first before moving to the rest. If you want TradeOps to build the whole thing for your business, visit tradeops.com — that's exactly what we do.`,
    tool_question: `Depends on your current setup. If you're under 5 trucks, Jobber or Housecall Pro handles this fine. If you're over that, ServiceTitan or GHL gives you more flexibility. What software are you on now?`,
    success_share: `This is the stuff ─ actually doing it beats just watching forever. Keep building. What's the next system you're working on?`,
    skepticism: `Fair point. The specifics do vary by trade and market size. What part feels like it won't translate to your situation? I might have a more specific angle that fits.`,
    content_request: `Adding it to the list — that's a good one. Subscribe so you catch it when it drops.`,
    pushback: `Appreciate you pointing that out. What specifically felt off? I'd rather fix the content than let something incomplete stand.`,
    general: `Glad it was useful. More implementation tutorials coming every week — subscribe so you don't miss them. 🔧`,
  };
  return responses[intent] || `Thanks for watching. If you want this system built for your business instead of building it yourself, visit tradeops.com.`;
}

module.exports = { generateCommentResponse, VOICE_PROFILE };

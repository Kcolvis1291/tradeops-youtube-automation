/**
 * TradeOps Script Agent — v2 (Education-First Strategy)
 *
 * CONTENT ANGLE: Teach viewers HOW to implement the system themselves.
 * Every video = a complete how-to tutorial a contractor can execute this week.
 *
 * COMPETITOR DIFFERENTIATION:
 *   Profitable Tradie  → Explains why you need systems. TradeOps shows step-by-step how to build them.
 *   Profit for Contractors → Financial coaching. TradeOps = implementation walkthroughs.
 *   ServiceTitan YT   → Product demos only. TradeOps = software-agnostic systems education.
 *
 * CTA (every video, every format):
 *   "If you want this built FOR you instead of BY you — that's what we do. Visit tradeops.com."
 *   Done-for-you positioning. Learn and do it yourself, OR hire TradeOps.
 *
 * Formats:
 *   TUTORIAL  — Solo host walks through building a specific system step by step
 *   BREAKDOWN — Solo host dissects a concept with real numbers and templates
 *   INTERVIEW — Host + successful trades operator who built and uses the system
 */

const axios = require('axios');

// ── Channel Voice ─────────────────────────────────────────────────────────────
const CHANNEL_VOICE = {
  persona: 'A contractor who figured out the systems, scaled the business, and now teaches other operators exactly what to do — step by step. Not a guru. Not a coach. A peer who\'s done the work and is handing over the playbook.',
  tone: 'Direct, practical, peer-to-peer. Zero fluff. Uses real numbers. Calls out what competitors don\'t teach. Respects the viewer\'s intelligence — they\'re busy operators, not students.',
  style: 'Tutorial-first. Every section delivers something tangible. Short sentences. Active voice. "Here\'s what you do" not "you should consider doing." Industry-specific language.',
  audience: 'Home service business owners ($500K–$5M revenue): plumbers, electricians, HVAC, roofers, landscapers, painters, GCs who want to implement real systems without a coaching program.',
  differentiator: 'Where other channels say "build a hiring system," TradeOps says "here are the 6 steps, here\'s the template, here\'s what to say in the interview — let\'s build it right now."',
};

// ── CTA Templates (Done-For-You Positioning) ──────────────────────────────────
const DFY_CTA = {
  standard: `Now you have the full system. You can take everything in this video and build it yourself — and if you do, it will work.

But if you'd rather have this built FOR you instead of BY you, that's exactly what TradeOps does. We implement this for your business — the whole thing — so you don't have to spend weekends figuring it out.

Visit tradeops.com to see how that works. Link is in the description.

Hit subscribe — we drop a new systems tutorial every week. I'll see you in the next one.`,

  interview: `[GUEST NAME] just gave you the real playbook — not theory, not concepts, the actual system they use.

If you want to implement everything they described, you can do it yourself using what they laid out today. Or, if you'd rather have TradeOps build it for your business, visit tradeops.com and see what that looks like.

[To guest] Where can people follow your story?

[GUEST ANSWER]

Go watch this video next — [GESTURE TO END SCREEN] — it goes deeper on everything we covered today. See you there.`,

  breakdown: `That's the complete breakdown. You now understand exactly how this works and why most operators get it wrong.

The implementation guide is in the description — download it and work through it this week. If you'd rather have TradeOps handle the implementation for your specific business, visit tradeops.com.

One more video before you go — watch this one next. [GESTURE] See you there.`,
};

// ── Script Structures ─────────────────────────────────────────────────────────
const TUTORIAL_STRUCTURE = `
Structure this as a hands-on HOW-TO tutorial — the viewer should be able to PAUSE and IMPLEMENT as they watch.

Use these labeled sections:
[HOOK] - 30–45 seconds. Open with a specific painful truth or bold statement about this system — NOT "Hey guys welcome back." No generic opener. Make a contractor stop scrolling in the first 5 seconds.
[WHAT YOU'LL BUILD] - 45–60 seconds. Tell the viewer exactly what system they're going to build by the end of this video. Name the deliverable. "By the end of this video you'll have a [specific thing] that [does specific outcome]." Make it concrete.
[WHY THIS MATTERS] - 60–90 seconds. The cost of NOT having this system. Real numbers. Real examples. "Contractors without this system are losing X per month / burning Y hours per week / can't hire because..."
[THE SYSTEM - STEP 1] through [THE SYSTEM - STEP N] - This is the main content. Build the system step by step. Each step = a labeled section. Be specific: name the tool, the exact workflow, the exact template fields, the exact script to use. 4–7 steps minimum.
[WHAT THEY GET WRONG] - 60–90 seconds. 2–3 common mistakes — what Profitable Tradie and other coaching channels don't tell you. This is where TradeOps earns trust by being more specific than anyone else.
[THIS WEEK'S ACTION] - 45 seconds. One specific thing they can do TODAY to start. Not "start thinking about" — a real concrete first step.
[DONE-FOR-YOU CTA] - Insert the DFY CTA here.
[DISCLAIMER] - Required disclaimer.
`;

const INTERVIEW_STRUCTURE = `
Structure this as an operator case study interview — the guest built and uses the system, the host draws out the implementation details.

Labeled sections:
[COLD_OPEN] - 20 seconds. Best quote from the guest teaser — something specific and surprising.
[HOST_INTRO] - 45 seconds. Host introduces the topic and why this system matters. No generic welcome. Name the system and the result it produces.
[GUEST_INTRO] - 45 seconds. Host introduces guest: trade, revenue range, team size, the specific system they built. "My guest runs a [trade] company doing [revenue]. They built [specific system] that [specific outcome]."
[THE BEFORE] - 3–4 minutes. What the business looked like BEFORE this system. Specific chaos, specific hours, specific revenue. Host asks probing questions: "What was the actual problem? What was breaking? What did it cost you?"
[BUILDING THE SYSTEM] - 6–8 minutes. Step-by-step how the guest built it. Host presses for specifics: "Walk me through exactly how you set it up. What tool? What does the workflow look like? What does your team actually do with this?"
[THE NUMBERS] - 2 minutes. Specific results. Revenue, hours saved, team size, owner involvement. Real numbers.
[WHAT THEY'D DO DIFFERENTLY] - 90 seconds. What the guest would skip or change. Honest reflection.
[RAPID_FIRE] - 90 seconds. 4 quick questions: Best tool, biggest mistake other contractors make, advice to someone starting at $500K, one book or resource recommendation.
[DONE-FOR-YOU CTA] - Insert the interview DFY CTA here.
[DISCLAIMER] - Required disclaimer.
`;

const BREAKDOWN_STRUCTURE = `
Structure this as an educational breakdown — deep explanation of a concept with real numbers and examples.

Labeled sections:
[HOOK] - 30 seconds. Specific, provocative statement about what most contractors get wrong about this topic.
[THE PROBLEM] - 60 seconds. Frame the issue with a real scenario — a contractor making a specific mistake that costs a specific amount.
[THE FRAMEWORK] - Main content. Break the concept into 3–5 clearly labeled components. For each: explain what it is, show a real example with numbers, and tell the viewer what to DO with it.
[REAL NUMBERS] - 90 seconds. Show actual numbers from real (or illustrative) contractor scenarios. Make it tangible.
[THE COMPARISON] - 60 seconds. What this looks like BEFORE implementing vs. AFTER. Side-by-side comparison.
[ACTION STEPS] - 45 seconds. 3 concrete steps to start this week.
[DONE-FOR-YOU CTA] - Insert the breakdown DFY CTA here.
[DISCLAIMER] - Required disclaimer.
`;

const SCRIPT_STRUCTURES = {
  tutorial: TUTORIAL_STRUCTURE,
  interview: INTERVIEW_STRUCTURE,
  breakdown: BREAKDOWN_STRUCTURE,
};

/**
 * Generate a video script
 * @param {Object} params - { topic, pillar, format, angle, guestInfo, targetLength }
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
async function generateScript(params, apiKey) {
  const {
    topic,
    pillar = 'job_costing',
    format = 'tutorial',
    angle = 'step by step implementation',
    guestInfo = null,
    targetLength = '10-14 minutes',
  } = params;

  const structure = SCRIPT_STRUCTURES[format] || SCRIPT_STRUCTURES.tutorial;
  const cta = DFY_CTA[format] || DFY_CTA.standard;
  const wordTarget = format === 'interview' ? '2,500–3,500' : '1,500–2,000';

  const prompt = buildScriptPrompt(topic, pillar, format, angle, guestInfo, targetLength, wordTarget, structure, cta);

  let scriptText;
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-opus-4-6',
        max_tokens: 5500,
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
    scriptText = response.data.content[0].text;
  } catch (err) {
    console.error('[ScriptAgent] Generation error:', err.message);
    throw err;
  }

  const qaResult = await scoreScript(scriptText, topic, format, apiKey);

  return {
    topic,
    pillar,
    format,
    script: scriptText,
    qaScore: qaResult.score,
    qaFeedback: qaResult.feedback,
    passed: qaResult.score >= 85,
    generatedAt: new Date().toISOString(),
  };
}

// ── QA Scoring ────────────────────────────────────────────────────────────────
async function scoreScript(scriptText, topic, format, apiKey) {
  const prompt = `You are a B2B YouTube content QA specialist evaluating an education-first HOW-TO script for trades business owners.

TOPIC: ${topic}
FORMAT: ${format.toUpperCase()}

The channel's strategy: Every video teaches contractors HOW to implement a specific system — step by step. NOT mindset, NOT concepts, actual build-it-yourself tutorials. Competitors (Profitable Tradie, Profit for Contractors) only teach concepts — TradeOps differentiates by showing implementation.

SCRIPT (first 3,500 chars):
${scriptText.substring(0, 3500)}

Score on 8 dimensions (12.5 pts each):
1. Hook quality — does it stop a scrolling contractor in 5 seconds without a generic opener?
2. Implementation depth — does the viewer actually learn HOW to build the system, step by step?
3. Specificity — real tool names, real numbers, real templates? No vague "you should have a system"?
4. Competitor differentiation — does this go deeper/more tactical than what Profitable Tradie or Profit for Contractors would cover?
5. Structure clarity — are labeled sections used, is it easy to follow and pause-and-implement?
6. Audience fit — speaks to operators ($500K–$5M trades businesses), not beginners or mega-corps?
7. Done-for-you CTA — is tradeops.com mentioned with clear "done for you" positioning (NOT "systems audit")?
8. Disclaimer — has appropriate business results disclaimer?

Return JSON: { score: number, breakdown: {hook, implementationDepth, specificity, competitorDiff, structure, audienceFit, cta, disclaimer}, feedback: "one specific improvement paragraph" }`;

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
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
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[ScriptAgent] QA error:', err.message);
  }
  return { score: 75, feedback: 'QA scoring unavailable — manual review recommended.' };
}

// ── Prompt Builder ────────────────────────────────────────────────────────────
function buildScriptPrompt(topic, pillar, format, angle, guestInfo, targetLength, wordTarget, structure, cta) {
  const guestBlock = guestInfo
    ? `GUEST INFO: ${JSON.stringify(guestInfo)}`
    : '';

  return `You are writing a ${format.toUpperCase()} YouTube script for "TradeOps" — an education-first B2B channel for home service business owners.

HOST PERSONA: ${CHANNEL_VOICE.persona}
TONE: ${CHANNEL_VOICE.tone}
STYLE: ${CHANNEL_VOICE.style}
AUDIENCE: ${CHANNEL_VOICE.audience}
DIFFERENTIATOR: ${CHANNEL_VOICE.differentiator}

TOPIC: ${topic}
CONTENT PILLAR: ${pillar.replace(/_/g, ' ')}
ANGLE: ${angle}
TARGET LENGTH: ${targetLength} (~${wordTarget} words at natural speaking pace)
${guestBlock}

SCRIPT STRUCTURE (follow exactly):
${structure}

DONE-FOR-YOU CTA (insert in the CTA section — do NOT change to "systems audit" — it must be "visit tradeops.com" done-for-you positioning):
${cta}

CRITICAL WRITING RULES:
- NEVER open with "Hey guys", "Welcome back", or any generic YouTube opener — start the [HOOK] immediately
- Every step in THE SYSTEM must be specific enough to implement: name the tool, show the workflow, give the template
- Use real numbers throughout — "$1,200/month lost", "4 hours saved per week", not "significant savings"
- Name real software tools where relevant: GoHighLevel, Jobber, ServiceTitan, Housecall Pro, QuickBooks, ServiceM8
- ${format === 'interview' ? 'Mark HOST: questions and GUEST: anticipated answers clearly throughout' : 'Write entirely from host first-person perspective'}
- Every [SECTION NAME] label must appear exactly in brackets
- The viewer should be able to PAUSE this video and start implementing during the video
- This script should go 2x deeper on implementation than anything Profitable Tradie or Profit for Contractors has produced

Write the complete production-ready script now.`;
}

module.exports = { generateScript, CHANNEL_VOICE, DFY_CTA, SCRIPT_STRUCTURES };

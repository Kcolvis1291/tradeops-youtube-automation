/**
 * TradeOps Autonomous YouTube Automation Server — v2
 *
 * STRATEGY: Education-first. Every video = a HOW-TO implementation tutorial.
 * CTA: "Want this done FOR you? Visit tradeops.com" (done-for-you positioning)
 *
 * COMPETITIVE POSITIONING:
 *   Profitable Tradie  → Concepts & mindset. Podcast-first. No step-by-step.
 *   Profit for Contractors → Financial coaching. No operational workflows.
 *   ServiceTitan YT   → Product demos only.
 *   TradeOps OWNS     → "Here's exactly HOW to build the system — step by step."
 *
 * FORMATS: TUTORIAL | BREAKDOWN | INTERVIEW
 * SCHEDULE: Tuesday 7pm ET (tutorial) | Thursday 7pm ET (breakdown) | Friday 7pm ET (interview, bi-weekly)
 * PILLARS: 8 rotating education-first content pillars
 */

require('dotenv').config();

const REQUIRED_VARS = ['ANTHROPIC_API_KEY'];
const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`[STARTUP ERROR] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const { runResearch, CHANNEL } = require('./agents/researchAgent');
const { scanTrends } = require('./agents/trendScanner');
const { generateScript } = require('./agents/scriptAgent');
const { generateSEO } = require('./agents/seoAgent');
const { generateThumbnails } = require('./agents/thumbnailAgent');
const { generateProductionBrief } = require('./agents/videoCreationAgent');
const { getNextPublishTime, getPublishQueue, generateUploadChecklist, getContentCalendar, PILLAR_ROTATION } = require('./agents/publishingAgent');
const { generateCommentResponse } = require('./agents/engageAgent');
const { runQA, getPipelineSummary } = require('./agents/managerQaAgent');
const { screenContent } = require('./agents/complianceScreener');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

const CONTENT_PILLARS = Object.keys(CHANNEL.pillars);

// Format rotation: 2 tutorials per week + 1 breakdown + bi-weekly interview
const FORMAT_ROTATION = ['tutorial', 'breakdown', 'tutorial', 'breakdown', 'tutorial', 'interview'];
let pillarRotationIndex = 0;
let formatRotationIndex = 0;
let calendarWeek = 0;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

let jobs = [];
let contentQueue = [];

// ── Job Queue ────────────────────────────────────────────────────────────────
function createJob(type, meta = {}) {
  const job = { id: uuidv4(), type, ...meta, status: 'pending', startedAt: null, completedAt: null, result: null, error: null, qaScore: null };
  jobs.push(job);
  if (jobs.length > 100) jobs = jobs.slice(-100);
  return job;
}

function updateJob(id, updates) {
  const idx = jobs.findIndex(j => j.id === id);
  if (idx >= 0) jobs[idx] = { ...jobs[idx], ...updates };
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────
async function runFullPipeline(options = {}) {
  const format = options.format || getNextFormat();
  const pillar = options.pillar || getNextPillar();
  const guestInfo = options.guestInfo || null;

  const job = createJob('full_pipeline', { pillar, format });
  updateJob(job.id, { status: 'running', startedAt: new Date().toISOString() });
  console.log(`[Pipeline] Starting: ${format.toUpperCase()} | Pillar: ${pillar} (job: ${job.id})`);

  try {
    // 1. Research — pillar-specific, competitor-gap aware
    console.log(`[Pipeline] Researching: ${pillar}...`);
    const research = await runResearch(pillar, API_KEY);
    const topic = research.recommendedVideo?.title
      || research.topTopics?.[0]?.title
      || `How to set up ${pillar.replace(/_/g, ' ')} for your trades business`;

    // 2. Trend scan (async context)
    const trendData = await scanTrends(API_KEY).catch(() => ({ trends: [] }));
    const relevantTrend = trendData.trends?.find(t => t.pillar === pillar);

    // 3. Script — education-first, how-to tutorial structure
    console.log(`[Pipeline] Generating ${format} script: "${topic}"`);
    const scriptParams = {
      topic,
      pillar,
      format,
      angle: research.recommendedVideo?.outline?.[0] || 'step by step implementation guide',
      guestInfo: format === 'interview' ? (guestInfo || buildPlaceholderGuest(pillar)) : null,
      targetLength: format === 'interview' ? '20-25 minutes' : '10-14 minutes',
    };
    let scriptResult = await generateScript(scriptParams, API_KEY);

    // QA gate — retry with stronger how-to framing if fails
    if (!scriptResult.passed) {
      console.warn(`[Pipeline] Script QA failed (score: ${scriptResult.qaScore}) — retrying with more implementation depth...`);
      const retry = await generateScript({ ...scriptParams, angle: 'complete step-by-step setup guide with real tool names and numbered steps' }, API_KEY);
      if (!retry.passed) {
        throw new Error(`Script QA gate failed twice. Score: ${retry.qaScore}/100 (min: 85). Need more implementation depth.`);
      }
      scriptResult = retry;
    }

    // 4. SEO — how-to intent titles, pillar-specific tags, DFY CTA in description
    console.log(`[Pipeline] Generating SEO...`);
    const seo = await generateSEO({
      topic,
      pillar,
      format,
      script: scriptResult.script,
      guestName: guestInfo?.name || null,
      relatedVideoTitle: getRelatedVideo(pillar, format),
    }, API_KEY);

    // 5. Thumbnails — angle/system-focused, not clickbait
    console.log(`[Pipeline] Generating thumbnails...`);
    const thumbnails = await generateThumbnails({
      topic,
      title: seo.title,
      pillar,
      format,
      guestName: guestInfo?.name || null,
      guestCredential: guestInfo?.credential || null,
    }, API_KEY);
ails({
      topic,
      title: seo.title,
      pillar,
      format,
      guestName: guestInfo?.name || null,
      guestCredential: guestInfo?.credential || null,
    }, API_KEY);

    // 6. Production brief
    const videoBrief = generateProductionBrief({ script: scriptResult.script, format, title: seo.title, pillar });

    // 7. Upload checklist
    const nextPublish = getNextPublishTime(format);
    const uploadChecklist = generateUploadChecklist({ ...seo, format });

    // 8. QA
    console.log(`[Pipeline] Running QA...`);
    const contentPackage = {
      pillar,
      format,
      research,
      topic,
      script: scriptResult.script,
      scriptQaScore: scriptResult.qaScore,
      seo,
      thumbnails,
      videoBrief,
    };
    const qaResult = runQA(contentPackage);

    const finalPackage = {
      ...contentPackage,
      qa: qaResult,
      uploadChecklist,
      nextPublish,
      trend: relevantTrend,
      jobId: job.id,
      createdAt: new Date().toISOString(),
    };

    contentQueue.push({
      ...finalPackage,
      status: qaResult.readyForPublish ? 'ready' : 'needs_review',
    });
    if (contentQueue.length > 30) contentQueue = contentQueue.slice(-30);

    updateJob(job.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      result: finalPackage,
      qaScore: qaResult.overallScore,
      pillar,
      format,
    });

    const statusIcon = qaResult.readyForPublish ? '✅' : '⚠️';
    console.log(`[Pipeline] ${statusIcon} Done | QA: ${qaResult.overallScore}/100 | Impl: ${qaResult.implementationTest} | Status: ${qaResult.readyForPublish ? 'READY' : 'NEEDS REVIEW'}`);
    sendWebhookNotification(finalPackage, qaResult);
    return finalPackage;

  } catch (err) {
    console.error(`[Pipeline] ❌ Failed:`, err.message);
    updateJob(job.id, { status: 'failed', error: err.message, completedAt: new Date().toISOString(), pillar, format });
    throw err;
  }
}

// ── Rotation Helpers ──────────────────────────────────────────────────────────
function getNextPillar() {
  const week = PILLAR_ROTATION[calendarWeek % PILLAR_ROTATION.length];
  const pillar = week.tuesday?.pillar || CONTENT_PILLARS[pillarRotationIndex % CONTENT_PILLARS.length];
  pillarRotationIndex++;
  return pillar;
}

function getNextFormat() {
  const fmt = FORMAT_ROTATION[formatRotationIndex % FORMAT_ROTATION.length];
  formatRotationIndex++;
  return fmt;
}

function getRelatedVideo(pillar, format) {
  const related = {
    job_costing: 'How to Calculate Your Real Overhead Rate as a Contractor',
    scheduling_systems: 'How to Build a Dispatch System That Runs Without You',
    owner_independence: 'How to Document Every Role in Your Trades Business',
    hiring_systems: 'How to Onboard a New Technician in 30 Days',
    kpi_tracking: 'How to Run a Weekly Numbers Meeting With Your Team',
    ghl_for_contractors: 'How to Build an Automated Lead Follow-Up in GoHighLevel',
    sop_systems: 'How to Train New Hires Using SOPs and Loom Videos',
    financial_systems: 'How to Set Up Bookkeeping for a Trades Business',
  };
  return related[pillar] || 'How to Systemize Your Trades Business — Start Here';
}

function buildPlaceholderGuest(pillar) {
  const guests = {
    job_costing: { name: '[Guest Name]', trade: 'Plumbing', revenue: '$1.8M', credential: '$1.8M Plumbing Company Owner', achievement: 'went from guessing margins to 24% net profit using flat rate' },
    scheduling_systems: { name: '[Guest Name]', trade: 'HVAC', revenue: '$2.2M', credential: '$2.2M HVAC Owner', achievement: 'eliminated dispatch chaos and doubled the number of jobs per tech per day' },
    owner_independence: { name: '[Guest Name]', trade: 'Electrical', revenue: '$3M', credential: '$3M Electrical Contractor', achievement: 'got out of the field completely in 11 months' },
    hiring_systems: { name: '[Guest Name]', trade: 'Roofing', revenue: '$1.5M', credential: '$1.5M Roofing Company Owner', achievement: 'built a hiring funnel that attracts 3 qualified applicants per week consistently' },
    ghl_for_contractors: { name: '[Guest Name]', trade: 'HVAC', revenue: '$900K', credential: 'HVAC Business Owner', achievement: 'automated 90% of follow-up with GHL — closed 40% more estimates' },
    sop_systems: { name: '[Guest Name]', trade: 'Landscaping', revenue: '$4M', credential: '$4M Landscaping Operator', achievement: 'documented every process and now trains new hires in 2 weeks instead of 3 months' },
  };
  return guests[pillar] || { name: '[Guest Name]', trade: 'General Contracting', revenue: '$1M+', credential: 'Trades Business Owner', achievement: 'built a systemized operation using the methods in this video' };
}

async function sendWebhookNotification(pkg, qaResult) {
  if (!process.env.NOTIFY_WEBHOOK_URL) return;
  try {
    const icon = qaResult.readyForPublish ? '✅' : '⚠️';
    await axios.post(process.env.NOTIFY_WEBHOOK_URL, {
      text: `${icon} *TradeOps Pipeline Complete*\n*Title:* ${pkg.seo?.title}\n*Format:* ${pkg.format?.toUpperCase()}\n*Pillar:* ${pkg.pillar}\n*QA Score:* ${qaResult.overallScore}/100\n*Impl Test:* ${qaResult.implementationTest}\n*Status:* ${qaResult.readyForPublish ? 'Ready to publish' : 'Needs review'}\n*Publish:* ${pkg.nextPublish?.formattedTime}`,
    });
  } catch (e) { /* silent */ }
}

// ── Cron Schedule ─────────────────────────────────────────────────────────────
// Tuesday 5am ET — Tutorial pipeline
cron.schedule('0 5 * * 2', async () => {
  console.log('[Cron] Tuesday: Tutorial pipeline');
  try { await runFullPipeline({ format: 'tutorial' }); }
  catch (err) { console.error('[Cron] Tutorial failed:', err.message); }
}, { timezone: 'America/New_York' });
own pipeline
cron.schedule('0 5 * * 4', async () => {
  console.log('[Cron] Thursday: Breakdown pipeline');
  try { await runFullPipeline({ format: 'breakdown' }); }
  catch (err) { console.error('[Cron] Breakdown failed:', err.message); }
}, { timezone: 'America/New_York' });

// Every other Friday 5am ET — Interview pipeline (bi-weekly)
// Using week number check
cron.schedule('0 5 * * 5', async () => {
  const weekNum = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 604800000);
  if (weekNum % 2 === 0) {
    console.log('[Cron] Friday (bi-weekly): Interview pipeline');
    try { await runFullPipeline({ format: 'interview' }); }
    catch (err) { console.error('[Cron] Interview failed:', err.message); }
  }
}, { timezone: 'America/New_York' });

// Daily 7am ET — Trend scan
cron.schedule('0 7 * * *', async () => {
  console.log('[Cron] Daily trend scan');
  try {
    const trends = await scanTrends(API_KEY);
    console.log(`[Cron] ${trends.trends?.length || 0} opportunities found`);
  } catch (err) { console.error('[Cron] Trend scan failed:', err.message); }
}, { timezone: 'America/New_York' });

// Hourly publish reminders
cron.schedule('0 * * * *', () => {
  const now = new Date();
  for (const fmt of ['tutorial', 'breakdown', 'interview']) {
    const next = getNextPublishTime(fmt);
    if (next) {
      const hoursUntil = (next.date - now) / (1000 * 60 * 60);
      if (hoursUntil > 0 && hoursUntil <= 2) {
        const ready = contentQueue.filter(c => c.format === fmt && c.status === 'ready');
        const warn = ready.length === 0 ? '⚠️ NO CONTENT READY' : `${ready.length} ready`;
        console.log(`[Reminder] �
 ${fmt.toUpperCase()} publish in ${Math.round(hoursUntil * 60)}min — ${warn}`);
      }
    }
  }
});

// Keep-alive
if (process.env.SELF_URL) {
  cron.schedule('*/14 * * * *', async () => {
    try { await axios.get(process.env.SELF_URL + '/health'); } catch (e) {}
  });
}

// ── API Routes ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), channel: 'TradeOps', strategy: 'education-first how-to', timestamp: new Date().toISOString() });
});

app.get('/api/dashboard', (req, res) => {
  const queue = getPublishQueue(contentQueue);
  const summary = getPipelineSummary(jobs);
  const calendar = getContentCalendar();
  res.json({
    queue, summary,
    recentJobs: jobs.slice(-20).reverse(),
    contentPillars: CONTENT_PILLARS,
    nextPillar: CONTENT_PILLARS[pillarRotationIndex % CONTENT_PILLARS.length],
    nextFormat: FORMAT_ROTATION[formatRotationIndex % FORMAT_ROTATION.length],
    calendar: calendar.calendar.slice(0, 4),
    strategy: {
      angle: 'Education-first — HOW-TO implementation tutorials',
      cta: 'Done-for-you positioning — tradeops.com',
      competitors: CHANNEL.competitorGaps,
    },
  });
});

app.post('/api/pipeline/run', async (req, res) => {
  const { pillar, format = 'tutorial', guestInfo } = req.body;
  const selectedPillar = pillar && CONTENT_PILLARS.includes(pillar) ? pillar : getNextPillar();
  const selectedFormat = ['tutorial', 'breakdown', 'interview'].includes(format) ? format : 'tutorial';
  res.json({ message: 'Pipeline started', pillar: selectedPillar, format: selectedFormat, status: 'running' });
  runFullPipeline({ pillar: selectedPillar, format: selectedFormat, guestInfo }).catch(err =>
    console.error('[API] Pipeline error:', err.message)
  );
});

app.post('/api/pipeline/run-batch', async (req, res) => {
  res.json({ message: 'Full batch: tutorial + breakdown + interview', status: 'running' });
  runFullPipeline({ format: 'tutorial' }).catch(e => console.error('[API]', e.message));
  setTimeout(() => runFullPipeline({ format: 'breakdown' }).catch(e => console.error('[API]', e.message)), 5000);
  setTimeout(() => runFullPipeline({ format: 'interview' }).catch(e => console.error('[API]', e.message)), 10000);
});

app.get('/api/jobs', (req, res) => res.json({ jobs: jobs.slice(-50).reverse(), total: jobs.length }));
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.find(j => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.get('/api/content', (req, res) => {
  const { pillar, format, status } = req.query;
  let queue = contentQueue;
  if (pillar) queue = queue.filter(c => c.pillar === pillar);
  if (format) queue = queue.filter(c => c.format === format);
  if (status) queue = queue.filter(c => c.status === status);
  res.json({ content: queue.slice(-20).reverse(), total: queue.length });
});

app.post('/api/agents/script', async (req, res) => {
  const { topic, pillar, format = 'tutorial', angle, guestInfo } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try { res.json(await generateScript({ topic, pillar: pillar || 'job_costing', angle, format, guestInfo }, API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents/seo', async (req, res) => {
  const { topic, pillar, format, script, guestName } = req.body;
  if (!topic) return res.status(400).json({ error: 'topic required' });
  try { res.json(await generateSEO({ topic, pillar: pillar || 'job_costing', format: format || 'tutorial', script, guestName }, API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents/research', async (req, res) => {
  const { pillar } = req.body;
  try { res.json(await runResearch(pillar || 'all', API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents/trends', async (req, res) => {
  try { res.json(await scanTrends(API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents/thumbnails', async (req, res) => {
  const { topic, title, pillar, format, guestName, guestCredential } = req.body;
  if (!topic || !title) return res.status(400).json({ error: 'topic and title required' });
  try { res.json(await generateThumbnails({ topic, title, pillar: pillar || 'job_costing', format: format || 'tutorial', guestName, guestCredential }, API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/agents/compliance', (req, res) => res.json(screenContent(req.body)));

app.post('/api/agents/engage', async (req, res) => {
  const { comment, videoTopic, pillar } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment required' });
  try { res.json(await generateCommentResponse({ comment, videoTopic, pillar }, API_KEY)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/publish-queue', (req, res) => res.json(getPublishQueue(contentQueue)));
app.get('/api/pillars', (req, res) => res.json({ pillars: CONTENT_PILLARS, channel: CHANNEL }));
app.get('/api/calendar', (req, res) => res.json(getContentCalendar()));

app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║      TradeOps YouTube Automation Server — v2             ║
║      Running on port ${PORT}                                 ║
╠══════════════════════════════════════════════════════════╣
║  Strategy: Education-First HOW-TO Implementation         ║
║  CTA: "Done for you — visit tradeops.com"                ║
╠══════════════════════════════════════════════════════════╣
║  Pillars: ${CONTENT_PILLARS.length} rotating education pillars                   ║
║  Formats: Tutorial | Breakdown | Interview                ║
╚══════════════════════════════════════════════════════════╝
║  Cron: Tue 5am ET  → Tutorial pipeline                    ║
║        Thu 5am ET  → Breakdown pipeline                  ║
║        Fri 5am ET  → Interview pipeline (bi-weekly)       ║
║        Daily 7am   → Trend scan                          ║
║        Hourly      → Publish reminders                    ║
╚══════════════════════════════════════════════════════════╝
║  Beats: Profitable Tradie + Profit for Contractors       ║
║         by going 2x deeper on implementation              ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;

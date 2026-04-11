/**
 * TradeOps Autonomous YouTube Automation Server — v3
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
 * SCHEDULE: Tuesday 5am ET (tutorial) | Thursday 5am ET (breakdown) | Friday 5am ET (interview, bi-weekly)
 * PILLARS: 8 rotating education-first content pillars
 *
 * v3 ADDITIONS:
 *   - ElevenLabs TTS voiceover (ELEVENLABS_API_KEY)
 *   - FFmpeg video render → MP4 landscape + vertical Shorts
 *   - YouTube auto-upload (YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN)
 *   - TikTok auto-post (TIKTOK_ACCESS_TOKEN)
 *   - Instagram Reels auto-post (INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_USER_ID)
 *   - Twitter/X auto-post (TWITTER_API_KEY / SECRET / ACCESS_TOKEN / ACCESS_TOKEN_SECRET)
 *   - /auth/youtube for one-time Google OAuth setup
 *   - /media/:filename for serving videos to Instagram
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

// v3: Video production + publishing agents
const { generateVoiceover } = require('./agents/elevenLabsAgent');
const { renderVideo } = require('./agents/videoRenderer');
const { uploadVideoAndShorts, getAuthUrl, exchangeCodeForTokens } = require('./agents/youtubeAgent');
const { uploadToTikTok } = require('./agents/tiktokAgent');
const { uploadToInstagram } = require('./agents/instagramAgent');
const { uploadToTwitter } = require('./agents/twitterAgent');
const { MsEdgeTTS, OUTPUT_FORMAT: EDGE_TTS_FORMAT } = require('msedge-tts');

const path = require('path');
const fs = require('fs');

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

    // 5. Thumbnails — in outcome/system-focused, not clickbait
    console.log(`[Pipeline] Generating thumbnails...`);
    const thumbnails = await generateThumbnails({
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

    // ── 9. Video Production + Publishing (only if QA passed) ─────────────────
    let videoResults = null;
    let publishResults = null;

    if (qaResult.readyForPublish && process.env.ELEVENLABS_API_KEY) {
      try {
        console.log(`[Pipeline] Generating ElevenLabs voiceover...`);
        const voiceover = await generateVoiceover({
          script: scriptResult.script,
          apiKey: process.env.ELEVENLABS_API_KEY,
        });

        console.log(`[Pipeline] Rendering video (FFmpeg)...`);
        videoResults = await renderVideo({
          script: scriptResult.script,
          title: seo.title,
          format,
          audioPath: voiceover.audioPath,
          outputDir: '/tmp',
        });

        // Publish to YouTube (full video + Shorts)
        publishResults = { youtube: null, tiktok: null, instagram: null, twitter: null };

        if (process.env.YOUTUBE_REFRESH_TOKEN) {
          try {
            console.log(`[Pipeline] Uploading to YouTube...`);
            publishResults.youtube = await uploadVideoAndShorts({
              landscapePath: videoResults.landscapePath,
              shortsPath: videoResults.shortsPath,
              contentPackage: finalPackage,
              publishNow: true,
            });
            console.log(`[Pipeline] ✅ YouTube: ${publishResults.youtube.video?.url}`);
          } catch (e) { console.error(`[Pipeline] YouTube upload failed: ${e.message}`); publishResults.youtube = { error: e.message }; }
        }

        // Post Shorts to TikTok
        if (process.env.TIKTOK_ACCESS_TOKEN && videoResults.shortsPath) {
          try {
            console.log(`[Pipeline] Posting to TikTok...`);
            publishResults.tiktok = await uploadToTikTok({ videoPath: videoResults.shortsPath, contentPackage: finalPackage });
            console.log(`[Pipeline] ✅ TikTok published`);
          } catch (e) { console.error(`[Pipeline] TikTok upload failed: ${e.message}`); publishResults.tiktok = { error: e.message }; }
        }

        // Post Reels to Instagram
        if (process.env.INSTAGRAM_ACCESS_TOKEN && videoResults.shortsPath) {
          try {
            console.log(`[Pipeline] Posting to Instagram...`);
            publishResults.instagram = await uploadToInstagram({ videoPath: videoResults.shortsPath, contentPackage: finalPackage });
            console.log(`[Pipeline] ✅ Instagram Reel published`);
          } catch (e) { console.error(`[Pipeline] Instagram upload failed: ${e.message}`); publishResults.instagram = { error: e.message }; }
        }

        // Post to Twitter/X
        if (process.env.TWITTER_API_KEY && videoResults.shortsPath) {
          try {
            console.log(`[Pipeline] Posting to Twitter/X...`);
            publishResults.twitter = await uploadToTwitter({ videoPath: videoResults.shortsPath, contentPackage: finalPackage });
            console.log(`[Pipeline] ✅ Twitter: ${publishResults.twitter.url}`);
          } catch (e) { console.error(`[Pipeline] Twitter upload failed: ${e.message}`); publishResults.twitter = { error: e.message }; }
        }

        // Clean up temp video files
        try {
          if (videoResults.landscapePath && fs.existsSync(videoResults.landscapePath)) fs.unlinkSync(videoResults.landscapePath);
          if (videoResults.shortsPath && fs.existsSync(videoResults.shortsPath)) fs.unlinkSync(videoResults.shortsPath);
          if (voiceover.audioPath && fs.existsSync(voiceover.audioPath)) fs.unlinkSync(voiceover.audioPath);
        } catch (e) { /* silent cleanup */ }

      } catch (videoErr) {
        console.error(`[Pipeline] ⚠️ Video/publish step failed: ${videoErr.message}`);
        videoResults = { error: videoErr.message };
      }
    } else if (qaResult.readyForPublish && !process.env.ELEVENLABS_API_KEY) {
      console.log(`[Pipeline] ℹ️ Skipping video render — ELEVENLABS_API_KEY not set.`);
    }

    finalPackage.videoResults = videoResults;
    finalPackage.publishResults = publishResults;

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
      videoResults,
      publishResults,
    });

    const statusIcon = qaResult.readyForPublish ? '✅' : '⚠️';
    const publishSummary = publishResults
      ? Object.entries(publishResults).filter(([, v]) => v && !v.error).map(([k]) => k).join(', ') || 'none posted'
      : 'video disabled';
    console.log(`[Pipeline] ${statusIcon} Done | QA: ${qaResult.overallScore}/100 | Published: ${publishSummary}`);
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

// Thursday 5am ET — Breakdown pipeline
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
        console.log(`[Reminder] 📅 ${fmt.toUpperCase()} publish in ${Math.round(hoursUntil * 60)}min — ${warn}`);
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

// ── YouTube OAuth Flow (one-time setup) ───────────────────────────────────────
app.get('/auth/youtube', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (e) {
    res.status(500).send(`<h2>YouTube OAuth Setup Error</h2><p>${e.message}</p><p>Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in Railway environment variables first.</p>`);
  }
});

app.get('/auth/youtube/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`<h2>Auth Error</h2><p>${error}</p>`);
  if (!code) return res.status(400).send('<h2>No auth code received</h2>');

  try {
    const tokens = await exchangeCodeForTokens(code);
    res.send(`
      <h2>✅ YouTube Authorization Successful!</h2>
      <p>Copy the <strong>refresh_token</strong> below and add it as <code>YOUTUBE_REFRESH_TOKEN</code> in your Railway environment variables:</p>
      <pre style="background:#f0f0f0;padding:20px;border-radius:8px;word-break:break-all;">${tokens.refresh_token}</pre>
      <p><strong>Access Token</strong> (expires in 1 hour — you don't need to save this):</p>
      <pre style="background:#f0f0f0;padding:20px;border-radius:8px;word-break:break-all;opacity:0.6;">${tokens.access_token}</pre>
      <hr>
      <p>After adding YOUTUBE_REFRESH_TOKEN to Railway, redeploy and the pipeline will auto-upload to YouTube.</p>
    `);
  } catch (e) {
    res.status(500).send(`<h2>Token Exchange Error</h2><p>${e.message}</p>`);
  }
});

// ── Media File Server (for Instagram — needs public URL to pull from) ─────────
app.use('/media', express.static('/tmp', {
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.mp4')) res.setHeader('Content-Type', 'video/mp4');
  },
}));

// ── Publishing Status API ─────────────────────────────────────────────────────
app.get('/api/publish-status', (req, res) => {
  const published = contentQueue
    .filter(c => c.publishResults)
    .slice(-10)
    .map(c => ({
      title: c.seo?.title,
      format: c.format,
      pillar: c.pillar,
      createdAt: c.createdAt,
      youtube: c.publishResults?.youtube?.video?.url || c.publishResults?.youtube?.error || null,
      youtubeShorts: c.publishResults?.youtube?.shorts?.url || null,
      tiktok: c.publishResults?.tiktok?.publishId || c.publishResults?.tiktok?.error || null,
      instagram: c.publishResults?.instagram?.mediaId || c.publishResults?.instagram?.error || null,
      twitter: c.publishResults?.twitter?.url || c.publishResults?.twitter?.error || null,
    }));
  res.json({ published, total: published.length });
});

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
║  Pillars: ${CONTENT_PILLARS.length} rotating education pillars                    ║
║  Formats: Tutorial | Breakdown | Interview                ║
╠══════════════════════════════════════════════════════════╣
║  Cron: Tue 5am ET  j�HH�Q�ѽɥ�������������������������������VD+�VD��������Q�ԀՅ��P���H�	ɕ����ݸ�����������������������������VD+�VD��������ɤ�Յ��P���H�%�ѕ�٥�܁�������������ݕ���䤐�������VD+�VD������������݅������H�Qɕ���͍�����������������������������VD+�VD��������!��ɱ䀀�����H�AՉ��͠�ɕ������̀��������������������VD+�Vk�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�VC�Vt(�����)���()���ձ��������̀����* Contractors       ║
║         by going 2x deeper on implementation             ║
╚══════════════════════════════════════════════════════════╝
  `);
});


// ── Bypass endpoint: run ElevenLabs → FFmpeg → YouTube from pre-written script
app.post('/api/pipeline/from-script', async (req, res) => {
  const { script, title, description, tags, pillar, format } = req.body;
  if (!script || !title) return res.status(400).json({ error: 'script and title required' });

  const job = createJob('from_script', { pillar: pillar || 'ghl_for_contractors', format: format || 'tutorial' });
  updateJob(job.id, { status: 'running', startedAt: new Date().toISOString() });
  res.json({ message: 'Pipeline started from script', jobId: job.id, status: 'running' });

  try {
    const seo = {
      title,
      description: description || title,
      tags: tags || ['home service business', 'contractor tips', 'tradeops', 'GoHighLevel', 'follow-up automation']
    };
    console.log('[from-script] Starting voiceover generation...');
    // TTS: msedge-tts attempt, fallback to /dev/zero silence via fluent-ffmpeg
        const _audioPath = '/tmp/voiceover_' + Date.now() + '.mp3';
        const _cleanScript = script.replace(/\[.*?\]/g, '').replace(/---+/g, '').replace(/\n{3,}/g, '\n\n').trim();
        console.log('[from-script] Script length:', _cleanScript.length, 'chars');
        const _ffmpegLib = require('fluent-ffmpeg');
        try {
          const _ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
          _ffmpegLib.setFfmpegPath(_ffmpegPath);
          console.log('[from-script] ffmpeg path:', _ffmpegPath);
        } catch(_fe) {
          console.log('[from-script] Using system ffmpeg');
        }
        let _ttsSuccess = false;
        // Try msedge-tts
        try {
          console.log('[from-script] Trying Edge TTS, MsEdgeTTS type:', typeof MsEdgeTTS);
          if (typeof MsEdgeTTS === 'function') {
            const _edgeTts = new MsEdgeTTS();
            await _edgeTts.setMetadata('en-US-ChristopherNeural', EDGE_TTS_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
            await _edgeTts.toFile(_audioPath, _cleanScript);
            _ttsSuccess = true;
            console.log('[from-script] Edge TTS success');
          }
        } catch (_ttsErr) {
          console.warn('[from-script] Edge TTS failed:', String(_ttsErr));
        }
        // Fallback: /dev/zero silence (no lavfi needed)
        if (!_ttsSuccess) {
          console.log('[from-script] Generating silent audio via /dev/zero...');
          await new Promise((_res, _rej) => {
            _ffmpegLib()
              .input('/dev/zero')
              .inputOptions(['-ar 44100', '-ac 2', '-f s16le'])
              .duration(420)
              .audioCodec('libmp3lame')
              .audioBitrate('128k')
              .output(_audioPath)
              .on('end', () => { console.log('[from-script] Silent audio done'); _res(); })
              .on('error', (e) => { console.error('[from-script] Audio error:', e.message); _rej(e); })
              .run();
          });
        }
        const voiceover = { audioPath: _audioPath };
    console.log('[from-script] Voiceover done, rendering video...');
    const videoResults = await renderVideo({
      script,
      title,
      format: format || 'tutorial',
      audioPath: voiceover.audioPath,
      outputDir: '/tmp'
    });
    console.log('[from-script] Video rendered, uploading to YouTube...');
    let youtubeResult = null;
    if (process.env.YOUTUBE_REFRESH_TOKEN) {
      youtubeResult = await uploadVideoAndShorts({
        landscapePath: videoResults.landscapePath,
        shortsPath: videoResults.shortsPath,
        contentPackage: { seo, pillar: pillar || 'ghl_for_contractors', format: format || 'tutorial', script },
        publishNow: true,
      });
      console.log('[from-script] YouTube upload complete:', JSON.stringify(youtubeResult?.video?.url));
    } else {
      console.log('[from-script] No YOUTUBE_REFRESH_TOKEN — skipping upload');
    }
    updateJob(job.id, { status: 'completed', completedAt: new Date().toISOString(), result: { youtube: youtubeResult } });
    console.log('[from-script] Job ' + job.id + ' completed');
  } catch (err) {
    console.error('[from-script] Error:', err.message);
    updateJob(job.id, { status: 'failed', error: err.message, completedAt: new Date().toISOString() });
  }
});

module.exports = app;

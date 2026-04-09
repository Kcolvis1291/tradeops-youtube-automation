/**
 * TradeOps Instagram Upload Agent
 * Posts Reels to Instagram using the Instagram Graph API
 *
 * Required Railway env vars:
 *   INSTAGRAM_ACCESS_TOKEN  — Long-lived Instagram Graph API access token
 *   INSTAGRAM_USER_ID       — Instagram Business account user ID
 *   INSTAGRAM_VIDEO_HOST_URL — Public URL where Railway can serve video files
 *                              (use SELF_URL env var if videos are served from server)
 *
 * Note: Instagram Graph API requires:
 *   - Instagram Business or Creator account
 *   - Facebook Page connected to the account
 *   - Facebook Developer App with instagram_basic + instagram_content_publish permissions
 *
 * Instagram video upload flow:
 *   1. Upload video to a publicly accessible URL (e.g., serve from Railway or instagram upload to S3)
 *   2. Create a media container with the video URL → get container ID
 *   3. Wait for container to finish processing
 *   4. Publish the container
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const http = require('http');

const GRAPH_API_BASE = 'graph.facebook.com';
const GRAPH_API_VERSION = 'v18.0';

/**
 * Make a Graph API request
 */
function graphRequest(method, endpoint, params = {}, body = null) {
  return new Promise((resolve, reject) => {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const queryParams = new URLSearchParams({ access_token: accessToken, ...params }).toString();
    const path_ = `/${GRAPH_API_VERSION}/${endpoint}?${queryParams}`;

    const options = {
      hostname: GRAPH_API_BASE,
      path: path_,
      method,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(body)),
      } : {},
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(`Instagram API error: ${parsed.error.message} (code: ${parsed.error.code})`));
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(new Error(`Graph API parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Poll container status until it's ready (FINISHED)
 * Instagram video processing can take 30s - 3min
 */
async function waitForContainer(containerId, maxWaitSecs = 300) {
  const startTime = Date.now();
  let attempts = 0;

  while ((Date.now() - startTime) / 1000 < maxWaitSecs) {
    attempts++;
    const statusData = await graphRequest('GET', containerId, { fields: 'status_code,status' });
    const statusCode = statusData.status_code;

    console.log(`[Instagram] Container status: ${statusCode} (attempt ${attempts})`);

    if (statusCode === 'FINISHED') return true;
    if (statusCode === 'ERROR') throw new Error(`Instagram container processing failed: ${statusData.status}`);
    if (statusCode === 'EXPIRED') throw new Error('Instagram container expired before publishing.');

    // Wait 10 seconds before retrying
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`Instagram container processing timed out after ${maxWaitSecs}s`);
}

/**
 * Build Instagram caption from content package
 */
function buildCaption(contentPackage) {
  const { seo, pillar } = contentPackage;
  const title = seo?.title || 'TradeOps Tips';
  const hashtags = buildHashtags(contentPackage);

  return [
    title,
    '',
    'Want this done FOR you? Visit tradeops.com for a free systems audit 🔧',
    '',
    'Watch the full tutorial on YouTube → @TradeOps',
   '',
    hashtags.map(t => `#${t}`).join(' '),
  ].join('\n').substring(0, 2200);
}

function buildHashtags(contentPackage) {
  const base = ['TradeOps', 'Contractor', 'TradesBusiness', 'ContractorLife', 'SmallBusinessOwner', 'BusinessSystems'];
  const pillarTags = {
    job_costing: ['JobCosting', 'ContractorProfits', 'Markup'],
    scheduling_systems: ['Scheduling', 'FieldService', 'ServiceBusiness'],
    owner_independence: ['BusinessOwner', 'Systemize', 'Entrepreneur'],
    hiring_systems: ['Hiring', 'TeamBuilding', 'Leadership'],
    ghl_for_contractors: ['GoHighLevel', 'CRM', 'MarketingAutomation'],
    sop_systems: ['SOP', 'Processes', 'OperationsManagement'],
    financial_systems: ['Finance', 'BusinessFinance', 'Bookkeeping'],
    kpi_tracking: ['KPI', 'BusinessMetrics', 'Analytics'],
  };
  return [...base, ...(pillarTags[contentPackage.pillar] || [])].slice(0, 12);
}

/**
 * Get the public video URL for Instagram upload
 * Instagram requires a publicly accessible URL to pull the video from
 */
function getPublicVideoUrl(videoPath) {
  const selfUrl = process.env.SELF_URL || process.env.INSTAGRAM_VIDEO_HOST_URL;
  if (!selfUrl) throw new Error('SELF_URL or INSTAGRAM_VIDEO_HOST_URL must be set for Instagram uploads (Instagram needs to pull video from a public URL).');

  const filename = path.basename(videoPath);
  return `${selfUrl}/media/${filename}`;
}

/**
 * Main export: upload a Reels video to Instagram
 *
 * @param {Object} params
 * @param {string} params.videoPath - Local path to vertical MP4 (Shorts/Reels format)
 * @param {Object} params.contentPackage - Full content package from pipeline
 * @returns {Object} { platform, mediaId, status }
 */
async function uploadToInstagram(params) {
  const { videoPath, contentPackage } = params;

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken) throw new Error('INSTAGRAM_ACCESS_TOKEN not set. See credentials setup guide.');
  if (!userId) throw new Error('INSTAGRAM_USER_ID not set. See credentials setup guide.');
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const videoUrl = getPublicVideoUrl(videoPath);
  const caption = buildCaption(contentPackage);

  console.log(`[Instagram] Creating Reel container...`);
  console.log(`[Instagram] Video URL: ${videoUrl}`);

  // Step 1: Create media container
  const containerData = await graphRequest('POST', `${userId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption,
    share_to_feed: 'true',
  });

  const containerId = containerData.id;
  console.log(`[Instagram] Container created: ${containerId}`);

  // Step 2: Wait for video to finish processing
  console.log(`[Instagram] Waiting for video processing...`);
  await waitForContainer(containerId);

  // Step 3: Publish the container
  console.log(`[Instagram] Publishing Reel...`);
  const publishData = await graphRequest('POST', `${userId}/media_publish`, {
    creation_id: containerId,
  });

  const mediaId = publishData.id;
  console.log(`[Instagram] ✅ Reel published! Media ID: ${mediaId}`);

  return {
    platform: 'instagram',
    mediaId,
    containerId,
    status: 'published',
    caption: caption.substring(0, 100) + '...',
  };
}

module.exports = { uploadToInstagram, buildCaption, buildHashtags };

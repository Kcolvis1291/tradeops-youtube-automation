/**
 * TradeOps TikTok Upload Agent
 * Posts Shorts videos to TikTok using the TikTok Content Posting API
 *
 * Required Railway env vars:
 *   TIKTOK_ACCESS_TOKEN — TikTok for Business access token
 *                         Obtain via: https://developers.tiktok.com/
 *                         Scopes needed: video.upload, video.publish
 *
 * Note: TikTok requires a TikTok for Business / Creator account.
 *       Direct Post API requires business account approval.
 *       Fallback: PULL_UPLOAD mode lets TikTok pull from a URL.
 */

const https = require('https');
const fs = require('fs');

const TIKTOK_API_BASE = 'open.tiktokapis.com';

/**
 * Initialize a video upload with TikTok (get upload URL)
 */
function initVideoUpload(accessToken, fileSizeBytes, chunkSize = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const totalChunks = Math.ceil(fileSizeBytes / chunkSize);
    const body = JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: fileSizeBytes,
        chunk_size: Math.min(chunkSize, fileSizeBytes),
        total_chunk_count: totalChunks,
      },
    });

    const options = {
      hostname: TIKTOK_API_BASE,
      path: '/v2/post/publish/video/init/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error?.code && parsed.error.code !== 'ok') {
            reject(new Error(`TikTok init error: ${parsed.error.message}`));
          } else {
            resolve(parsed.data);
          }
        } catch (e) { reject(new Error(`TikTok init parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Upload a video chunk to TikTok
 */
function uploadChunk(uploadUrl, chunk, startByte, endByte, totalSize) {
  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes ${startByte}-${endByte}/${totalSize}`,
        'Content-Length': chunk.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 206 || res.statusCode === 200 || res.statusCode === 201) {
          resolve({ status: res.statusCode });
        } else {
          reject(new Error(`TikTok chunk upload failed: HTTP ${res.statusCode} — ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(chunk);
    req.end();
  });
}

/**
 * Publish the uploaded video with metadata
 */
function publishVideo(accessToken, publishId, caption, hashtags = []) {
  return new Promise((resolve, reject) => {
    const hashtagStr = hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' ');
    const fullCaption = `${caption}\n\n${hashtagStr}`.trim().substring(0, 2200);

    const body = JSON.stringify({
      publish_id: publishId,
      post_info: {
        title: fullCaption,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
    });

    const options = {
      hostname: TIKTOK_API_BASE,
      path: '/v2/post/publish/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error?.code && parsed.error.code !== 'ok') {
            reject(new Error(`TikTok publish error: ${parsed.error.message}`));
          } else {
            resolve(parsed.data);
          }
        } catch (e) { reject(new Error(`TikTok publish parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Build TikTok caption from content package
 */
function buildCaption(contentPackage) {
  const { seo, pillar, format } = contentPackage;
  const title = seo?.title || 'TradeOps Tips';
  // TikTok caption max 2200 chars
  const caption = `${title}\n\nWatch the full video on YouTube → @TradeOps\n\ntradeops.com for a free systems audit 🔧`;
  return caption;
}

function buildHashtags(contentPackage) {
  const base = ['TradeOps', 'ContractorBusiness', 'TradesBusiness', 'ContractorLife', 'SmallBusiness'];
  const pillarTags = {
    job_costing: ['JobCosting', 'ContractorTips', 'Profitability'],
    scheduling_systems: ['Scheduling', 'Dispatch', 'FieldService'],
    owner_independence: ['BusinessOwner', 'Systemize', 'Delegation'],
    hiring_systems: ['Hiring', 'Recruiting', 'TeamBuilding'],
    ghl_for_contractors: ['GoHighLevel', 'CRM', 'Automation'],
    sop_systems: ['SOP', 'ProcessDocumentation', 'Operations'],
    financial_systems: ['Finance', 'Bookkeeping', 'CashFlow'],
    kpi_tracking: ['KPI', 'Metrics', 'DataDriven'],
  };
  return [...base, ...(pillarTags[contentPackage.pillar] || [])].slice(0, 8);
}

/**
 * Main export: upload a Shorts video to TikTok
 *
 * @param {Object} params
 * @param {string} params.videoPath - Local path to vertical MP4 (Shorts format)
 * @param {Object} params.contentPackage - Full content package from pipeline
 * @returns {Object} { platform, publishId, status }
 */
async function uploadToTikTok(params) {
  const {
    videoPath,
    contentPackage,
  } = params;

  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) throw new Error('TIKTOK_ACCESS_TOKEN not set. See credentials setup guide.');
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const fileBuffer = fs.readFileSync(videoPath);
  const fileSizeBytes = fileBuffer.length;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  console.log(`[TikTok] Initiating upload (${fileSizeMB.toFixed(1)} MB)...`);

  // 1. Init upload
  const initData = await initVideoUpload(accessToken, fileSizeBytes);
  const { publish_id: publishId, upload_url: uploadUrl } = initData;

  // 2. Upload video in chunks (10MB chunks)
  const chunkSize = 10 * 1024 * 1024;
  const totalChunks = Math.ceil(fileSizeBytes / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * chunkSize;
    const endByte = Math.min(startByte + chunkSize - 1, fileSizeBytes - 1);
    const chunk = fileBuffer.slice(startByte, endByte + 1);
    console.log(`[TikTok] Uploading chunk ${i + 1}/${totalChunks}...`);
    await uploadChunk(uploadUrl, chunk, startByte, endByte, fileSizeBytes);
  }

  // 3. Publish
  const caption = buildCaption(contentPackage);
  const hashtags = buildHashtags(contentPackage);
  console.log(`[TikTok] Publishing video...`);
  const publishData = await publishVideo(accessToken, publishId, caption, hashtags);

  console.log(`[TikTok] ✅ Published! Publish ID: ${publishId}`);

  return {
    platform: 'tiktok',
    publishId,
    status: 'published',
    caption: caption.substring(0, 100) + '...',
  };
}

module.exports = { uploadToTikTok, buildCaption, buildHashtags };

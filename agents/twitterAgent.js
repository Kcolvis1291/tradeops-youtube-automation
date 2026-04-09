/**
 * TradeOps Twitter/X Upload Agent
 * Posts videos to Twitter/X using the Twitter API v2
 *
 * Required Railway env vars:
 *   TWITTER_API_KEY            — Twitter App API Key (Consumer Key)
 *   TWITTER_API_SECRET         — Twitter App API Secret (Consumer Secret)
 *   TWITTER_ACCESS_TOKEN       — OAuth 1.0a Access Token (for your account)
 *   TWITTER_ACCESS_TOKEN_SECRET — OAuth 1.0a Access Token Secret
 *
 * Note: Video upload uses the v1.1 media upload endpoint (chunked),
 *       then posts a tweet with the media_id using v2 tweets endpoint.
 *
 * Twitter video requirements:
 *   - Max size: 512 MB
 *   - Max duration: 140 seconds (2min 20s) for regular tweets
 *   - Recommended: H.264, AAC audio, MP4 container
 *   - For Shorts (vertical 9:16): works well as a native video tweet
 */

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const TWITTER_UPLOAD_BASE = 'upload.twitter.com';
const TWITTER_API_BASE = 'api.twitter.com';

// ── OAuth 1.0a Signing ────────────────────────────────────────────────────────

function generateOAuthHeader(method, url, params = {}) {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error('Twitter credentials not set. Need TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET.');
  }

  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...params, ...oauthParams };
  const sortedParams = Object.keys(allParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`
  ).join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams).sort().map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).join(', ');

  return `OAuth ${headerParts}`;
}

/**
 * Make a Twitter API request with OAuth 1.0a
 */
function twitterRequest(method, hostname, path_, queryParams = {}, body = null, contentType = 'application/json') {
  return new Promise((resolve, reject) => {
    const url = `https://${hostname}${path_}`;
    const oauthHeader = generateOAuthHeader(method, url, method === 'GET' ? queryParams : {});

    const queryString = Object.keys(queryParams).length
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';

    let bodyStr = null;
    if (body) {
      bodyStr = contentType === 'application/json' ? JSON.stringify(body) : new URLSearchParams(body).toString();
    }

    const options = {
      hostname,
      path: path_ + queryString,
      method,
      headers: {
        'Authorization': oauthHeader,
        ...(bodyStr ? {
          'Content-Type': contentType,
          'Content-Length': Buffer.byteLength(bodyStr),
        } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors && parsed.errors.length > 0) {
            reject(new Error(`Twitter API error: ${parsed.errors[0].message || JSON.stringify(parsed.errors[0])}`));
          } else if (parsed.error) {
            reject(new Error(`Twitter API error: ${parsed.error}`));
          } else {
            resolve(parsed);
          }
        } catch (e) { reject(new Error(`Twitter parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Upload raw binary chunk to Twitter media upload endpoint
 */
function uploadMediaChunk(mediaId, segmentIndex, chunk) {
  return new Promise((resolve, reject) => {
    const boundary = `----TwitterBoundary${Date.now()}`;
    const url = `https://${TWITTER_UPLOAD_BASE}/1.1/media/upload.json`;
    const oauthHeader = generateOAuthHeader('POST', url, {});

    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="command"\r\n\r\nAPPEND`,
      `--${boundary}\r\nContent-Disposition: form-data; name="media_id"\r\n\r\n${mediaId}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="segment_index"\r\n\r\n${segmentIndex}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="chunk.mp4"\r\nContent-Type: video/mp4\r\n\r\n`,
    ];

    const preamble = Buffer.from(parts.join('\r\n'));
    const epilogue = Buffer.from(`\r\n--${boundary}--`);
    const fullBody = Buffer.concat([preamble, chunk, epilogue]);

    const options = {
      hostname: TWITTER_UPLOAD_BASE,
      path: '/1.1/media/upload.json',
      method: 'POST',
      headers: {
        'Authorization': oauthHeader,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ success: true });
        } else {
          reject(new Error(`Twitter chunk upload failed: HTTP ${res.statusCode} — ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

/**
 * Poll media processing status until SUCCEEDED
 */
async function waitForMediaProcessing(mediaId, maxWaitSecs = 300) {
  const startTime = Date.now();

  while ((Date.now() - startTime) / 1000 < maxWaitSecs) {
    const status = await twitterRequest('GET', TWITTER_UPLOAD_BASE, '/1.1/media/upload.json', {
      command: 'STATUS',
      media_id: mediaId,
    });

    const processingInfo = status.processing_info;
    if (!processingInfo) return true; // No processing info = ready

    const state = processingInfo.state;
    console.log(`[Twitter] Media processing: ${state} (${processingInfo.progress_percent || 0}%)`);

    if (state === 'succeeded') return true;
    if (state === 'failed') throw new Error(`Twitter media processing failed: ${processingInfo.error?.message || 'Unknown error'}`);

    const waitSecs = processingInfo.check_after_secs || 5;
    await new Promise(r => setTimeout(r, waitSecs * 1000));
  }
  throw new Error(`Twitter media processing timed out after ${maxWaitSecs}s`);
}

/**
 * Build tweet text from content package
 */
function buildTweetText(contentPackage) {
  const { seo, pillar } = contentPackage;
  const title = seo?.title || 'TradeOps Tips';
  const hashtags = ['#TradeOps', '#ContractorBusiness', '#TradesBusiness'];

  const pillarHashtags = {
    job_costing: ['#JobCosting', '#Contractor'],
    scheduling_systems: ['#FieldService', '#Dispatch'],
    owner_independence: ['#BusinessSystems', '#Systemize'],
    hiring_systems: ['#Hiring', '#Trades'],
    ghl_for_contractors: ['#GoHighLevel', '#CRM'],
    sop_systems: ['#SOP', '#Operations'],
    financial_systems: ['#Finance', '#BusinessFinance'],
    kpi_tracking: ['#KPI', '#BusinessMetrics'],
  };

  const tags = [...hashtags, ...(pillarHashtags[pillar] || [])].slice(0, 5).join(' ');

  // Twitter max 280 chars
  const text = `${title}\n\nFull tutorial on YouTube 👇 @TradeOps\nFree systems audit: tradeops.com/audit\n\n${tags}`;
  return text.substring(0, 280);
}

/**
 * Main export: upload a video and post a tweet
 *
 * @param {Object} params
 * @param {string} params.videoPath - Local path to vertical MP4 (Shorts format)
 * @param {Object} params.contentPackage - Full content package from pipeline
 * @returns {Object} { platform, tweetId, mediaId, url }
 */
async function uploadToTwitter(params) {
  const { videoPath, contentPackage } = params;

  if (!process.env.TWITTER_API_KEY) throw new Error('Twitter credentials not set. See credentials setup guide.');
  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const fileBuffer = fs.readFileSync(videoPath);
  const fileSizeBytes = fileBuffer.length;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);

  if (fileSizeMB > 512) throw new Error(`Video too large for Twitter: ${fileSizeMB.toFixed(1)} MB (max 512 MB)`);

  console.log(`[Twitter] Initiating INIT upload (${fileSizeMB.toFixed(1)} MB)...`);

  // Step 1: INIT
  const initResponse = await twitterRequest('POST', TWITTER_UPLOAD_BASE, '/1.1/media/upload.json', {}, {
    command: 'INIT',
    total_bytes: fileSizeBytes,
    media_type: 'video/mp4',
    media_category: 'tweet_video',
  }, 'application/x-www-form-urlencoded');

  const mediaId = initResponse.media_id_string;
  console.log(`[Twitter] Media ID: ${mediaId}`);

  // Step 2: APPEND chunks (5MB each)
  const chunkSize = 5 * 1024 * 1024;
  const totalChunks = Math.ceil(fileSizeBytes / chunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * chunkSize;
    const chunk = fileBuffer.slice(startByte, startByte + chunkSize);
    console.log(`[Twitter] Uploading chunk ${i + 1}/${totalChunks}...`);
    await uploadMediaChunk(mediaId, i, chunk);
  }

  // Step 3: FINALIZE
  console.log(`[Twitter] Finalizing upload...`);
  await twitterRequest('POST', TWITTER_UPLOAD_BASE, '/1.1/media/upload.json', {}, {
    command: 'FINALIZE',
    media_id: mediaId,
  }, 'application/x-www-form-urlencoded');

  // Step 4: Wait for processing
  console.log(`[Twitter] Waiting for media processing...`);
  await waitForMediaProcessing(mediaId);

  // Step 5: Post the tweet
  const tweetText = buildTweetText(contentPackage);
  console.log(`[Twitter] Posting tweet...`);

  const tweetResponse = await twitterRequest('POST', TWITTER_API_BASE, '/2/tweets', {}, {
    text: tweetText,
    media: { media_ids: [mediaId] },
  });

  const tweetId = tweetResponse.data?.id;
  const twitterHandle = process.env.TWITTER_HANDLE || 'TradeOps';
  const tweetUrl = `https://twitter.com/${twitterHandle}/status/${tweetId}`;

  console.log(`[Twitter] ✅ Tweet posted: ${tweetUrl}`);

  return {
    platform: 'twitter',
    tweetId,
    mediaId,
    url: tweetUrl,
    text: tweetText.substring(0, 100) + '...',
  };
}

module.exports = { uploadToTwitter, buildTweetText };

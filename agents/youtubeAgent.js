/**
 * TradeOps YouTube Upload Agent
 * Uploads videos to YouTube using the YouTube Data API v3
 *
 * Required Railway env vars:
 *   YOUTUBE_CLIENT_ID       — Google Cloud OAuth2 Client ID
 *   YOUTUBE_CLIENT_SECRET   — Google Cloud OAuth2 Client Secret
 *   YOUTUBE_REFRESH_TOKEN   — OAuth2 refresh token (obtained via /auth/youtube flow)
 *
 * One-time auth flow:
 *   1. Deploy server
 *   2. Visit /auth/youtube in browser
 *   3. Authorize with Google account
 *   4. Copy the refresh_token from the callback
 *   5. Set YOUTUBE_REFRESH_TOKEN in Railway env vars
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

// ── OAuth2 Setup ──────────────────────────────────────────────────────────────

function getOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${process.env.SELF_URL || 'http://localhost:3000'}/auth/youtube/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET are required. See credentials setup guide.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getAuthenticatedClient() {
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('YOUTUBE_REFRESH_TOKEN not set. Visit /auth/youtube to authorize your Google account.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

/**
 * Generate OAuth authorization URL (for one-time setup)
 */
function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh_token
  });
}

/**
 * Exchange auth code for tokens (callback handler)
 */
async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Map TradeOps format/pillar to YouTube category
 * 27 = Education, 22 = People & Blogs
 */
function getCategoryId(format, pillar) {
  return '27'; // Education — best for how-to content
}

/**
 * Build YouTube video metadata from content package
 */
function buildVideoMetadata(contentPackage, isShort = false) {
  const { seo, format, pillar, script } = contentPackage;
  const title = isShort
    ? `${(seo.title || '').substring(0, 90)} #Shorts`
    : (seo.title || 'TradeOps — Systems for Trades Businesses');

  const description = isShort
    ? `${seo.description || ''}\n\n#Shorts #TradeOps #ContractorBusiness #TradesBusiness`
    : (seo.description || '') + '\n\n' + buildDescriptionFooter();

  const tags = isShort
    ? [...(seo.tags || []).slice(0, 10), 'Shorts', 'ContractorTips', 'TradesBusiness'].slice(0, 15)
    : (seo.tags || []).slice(0, 30);

  return {
    title: title.substring(0, 100),
    description: description.substring(0, 5000),
    tags,
    categoryId: getCategoryId(format, pillar),
    defaultLanguage: 'en',
    defaultAudioLanguage: 'en',
  };
}

function buildDescriptionFooter() {
  return [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔧 Want This Done FOR You?',
    'Visit tradeops.com for a free systems audit.',
    'We help trades businesses build the exact systems covered in this video.',
    '',
    '📋 Resources Mentioned:',
    '→ Free Systems Audit: tradeops.com/audit',
    '→ All templates and SOPs: tradeops.com/resources',
    '',
    '📱 Follow TradeOps:',
    '→ YouTube: @TradeOps',
    '→ Instagram: @tradeops',
    '→ TikTok: @tradeops',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');
}

/**
 * Upload a video file to YouTube
 *
 * @param {Object} params
 * @param {string} params.videoPath - Local path to MP4 file
 * @param {Object} params.contentPackage - Full content package from pipeline
 * @param {boolean} params.isShort - Whether this is a Shorts upload
 * @param {boolean} params.publishNow - If false, saves as private draft
 * @returns {Object} { videoId, url, shortsUrl }
 */
async function uploadToYouTube(params) {
  const {
    videoPath,
    contentPackage,
    isShort = false,
    publishNow = false,
  } = params;

  if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);

  const auth = getAuthenticatedClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const metadata = buildVideoMetadata(contentPackage, isShort);
  const fileSizeMB = fs.statSync(videoPath).size / (1024 * 1024);

  console.log(`[YouTube] Uploading ${isShort ? 'Short' : 'video'}: "${metadata.title}" (${fileSizeMB.toFixed(1)} MB)`);

  const uploadParams = {
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
        defaultLanguage: metadata.defaultLanguage,
        defaultAudioLanguage: metadata.defaultAudioLanguage,
      },
      status: {
        privacyStatus: publishNow ? 'public' : 'private',
        selfDeclaredMadeForKids: false,
        // For Shorts: schedule publish at optimal time if desired
        ...(publishNow && !isShort && contentPackage.nextPublish?.date
          ? { publishAt: new Date(contentPackage.nextPublish.date).toISOString() }
          : {}),
      },
    },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(videoPath),
    },
  };

  let lastProgress = 0;
  const response = await youtube.videos.insert(uploadParams, {
    onUploadProgress: (evt) => {
      const progress = Math.round(evt.bytesRead / fs.statSync(videoPath).size * 100);
      if (progress - lastProgress >= 10) {
        console.log(`[YouTube] Upload progress: ${progress}%`);
        lastProgress = progress;
      }
    },
  });

  const videoId = response.data.id;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const shortsUrl = isShort ? `https://www.youtube.com/shorts/${videoId}` : null;

  console.log(`[YouTube] ✅ Uploaded: ${isShort ? shortsUrl : url}`);

  return {
    videoId,
    url: isShort ? shortsUrl : url,
    shortsUrl,
    title: metadata.title,
    privacyStatus: publishNow ? 'public' : 'private',
    platform: 'youtube',
  };
}

/**
 * Upload both the full video and the Shorts version
 */
async function uploadVideoAndShorts(params) {
  const { landscapePath, shortsPath, contentPackage, publishNow = false } = params;

  const results = {};

  // Upload full video
  if (landscapePath && fs.existsSync(landscapePath)) {
    results.video = await uploadToYouTube({ videoPath: landscapePath, contentPackage, isShort: false, publishNow });
  }

  // Upload Shorts
  if (shortsPath && fs.existsSync(shortsPath)) {
    results.shorts = await uploadToYouTube({ videoPath: shortsPath, contentPackage, isShort: true, publishNow });
  }

  return results;
}

module.exports = { uploadToYouTube, uploadVideoAndShorts, getAuthUrl, exchangeCodeForTokens, buildVideoMetadata };

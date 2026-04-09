/**
 * TradeOps Video Renderer
 * Combines ElevenLabs audio + visual slides into MP4 using FFmpeg
 *
 * Produces:
 *   1. Full landscape video  (1920x1080, 16:9) — for YouTube
 *   2. Vertical Shorts video (1080x1920, 9:16) — for YouTube Shorts, TikTok, Instagram Reels, Twitter
 *
 * Dependencies: ffmpeg-static, fluent-ffmpeg
 * Uses ffmpeg-static so no system FFmpeg needed on Railway
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createCanvas } = require('canvas');

// Point fluent-ffmpeg at the static binary
ffmpeg.setFfmpegPath(ffmpegPath);

// TradeOps brand colors
const BRAND = {
  bg: '#1A1A1A',
  orange: '#F05A28',
  white: '#FFFFFF',
  gray: '#888888',
};

// ── Slide Image Generator ──────────────────────────────────────────────────────

/**
 * Parse script sections into slide data
 */
function parseScriptToSlides(script, title, format) {
  const slides = [];

  // Title card
  slides.push({
    type: 'title',
    title: title || 'TradeOps',
    subtitle: format ? format.toUpperCase() : '',
    duration: 4,
  });

  // Parse script sections
  const sectionRegex = /\[([A-Z_\s/]+)\]([\s\S]*?)(?=\[[A-Z_\s/]+\]|$)/g;
  let match;
  let hasMatches = false;

  while ((match = sectionRegex.exec(script)) !== null) {
    hasMatches = true;
    const label = match[1].trim();
    const content = match[2].trim();

    if (!content) continue;

    // Extract key point from section (first 120 chars of clean text)
    const cleanContent = content
      .replace(/\[[^\]]{0,200}\]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanContent) continue;

    const keyPoint = cleanContent.length > 120
      ? cleanContent.substring(0, 120).replace(/\s+\S+$/, '') + '...'
      : cleanContent;

    slides.push({
      type: 'section',
      label: label.replace(/_/g, ' '),
      keyPoint,
      duration: estimateSectionDuration(content),
    });
  }

  // If no sections parsed, create a single content slide
  if (!hasMatches) {
    const cleanScript = script.replace(/\[[^\]]{0,200}\]/g, '').trim();
    const preview = cleanScript.substring(0, 200);
    slides.push({ type: 'section', label: 'MAIN', keyPoint: preview, duration: 30 });
  }

  // CTA card
  slides.push({
    type: 'cta',
    title: 'Want This Done FOR You?',
    subtitle: 'Visit tradeops.com',
    duration: 5,
  });

  return slides;
}

function estimateSectionDuration(content) {
  const wordCount = content.split(/\s+/).length;
  return Math.max(5, Math.ceil(wordCount / 130 * 60));
}

/**
 * Draw a single slide frame to a PNG file
 * Returns path to PNG file
 */
function renderSlideFrame(slide, width, height, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BRAND.bg;
  ctx.fillRect(0, 0, width, height);

  // Orange accent bar (left side)
  ctx.fillStyle = BRAND.orange;
  ctx.fillRect(0, 0, 8, height);

  if (slide.type === 'title') {
    // TradeOps logo text
    ctx.fillStyle = BRAND.orange;
    ctx.font = `bold ${Math.round(width * 0.05)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('TRADEOPS', width / 2, height * 0.35);

    // Title
    ctx.fillStyle = BRAND.white;
    ctx.font = `bold ${Math.round(width * 0.045)}px Arial`;
    wrapText(ctx, slide.title, width / 2, height * 0.52, width * 0.8, Math.round(width * 0.055));

    // Subtitle
    if (slide.subtitle) {
      ctx.fillStyle = BRAND.gray;
      ctx.font = `${Math.round(width * 0.025)}px Arial`;
      ctx.fillText(slide.subtitle, width / 2, height * 0.75);
    }

    // Bottom bar
    ctx.fillStyle = BRAND.orange;
    ctx.fillRect(0, height - 6, width, 6);

  } else if (slide.type === 'cta') {
    ctx.fillStyle = BRAND.orange;
    ctx.font = `bold ${Math.round(width * 0.048)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(slide.title, width / 2, height * 0.42);

    ctx.fillStyle = BRAND.white;
    ctx.font = `bold ${Math.round(width * 0.055)}px Arial`;
    ctx.fillText(slide.subtitle, width / 2, height * 0.58);

    ctx.fillStyle = BRAND.gray;
    ctx.font = `${Math.round(width * 0.022)}px Arial`;
    ctx.fillText('tradeops.com/audit — Free Systems Audit', width / 2, height * 0.72);

    ctx.fillStyle = BRAND.orange;
    ctx.fillRect(0, height - 6, width, 6);

  } else {
    // Section slide
    // Section label
    ctx.fillStyle = BRAND.orange;
    ctx.font = `bold ${Math.round(width * 0.022)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(slide.label, 60, Math.round(height * 0.15));

    // Divider
    ctx.strokeStyle = BRAND.orange;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, Math.round(height * 0.18));
    ctx.lineTo(width - 60, Math.round(height * 0.18));
    ctx.stroke();

    // Key point text
    ctx.fillStyle = BRAND.white;
    ctx.font = `${Math.round(width * 0.032)}px Arial`;
    ctx.textAlign = 'left';
    wrapText(ctx, slide.keyPoint, 60, Math.round(height * 0.30), width - 120, Math.round(width * 0.038));

    // Lower third
    ctx.fillStyle = BRAND.gray;
    ctx.font = `${Math.round(width * 0.018)}px Arial`;
    ctx.textAlign = 'left';
    ctx.fillText('TradeOps | tradeops.com', 60, height - 40);
  }

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Wrap text within a canvas context
 */
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
}

// ── Video Rendering ────────────────────────────────────────────────────────────

/**
 * Create a slideshow video from slide images + audio
 * Uses FFmpeg concat demuxer for variable-duration slides
 */
function buildSlideVideo(slideImagePaths, slideDurations, audioPath, outputPath, width, height) {
  return new Promise((resolve, reject) => {
    // Build a concat file for FFmpeg
    const concatLines = slideImagePaths.map((p, i) =>
      `file '${p}'\nduration ${slideDurations[i]}`
    ).join('\n');
    // Add the last file again (FFmpeg concat demuxer quirk)
    const lastFile = slideImagePaths[slideImagePaths.length - 1];
    const concatContent = concatLines + `\nfile '${lastFile}'`;

    const concatFilePath = path.join(os.tmpdir(), `tradeops_concat_${Date.now()}.txt`);
    fs.writeFileSync(concatFilePath, concatContent);

    const totalSlidesDuration = slideDurations.reduce((a, b) => a + b, 0);

    const cmd = ffmpeg();

    // Input 1: slide images via concat demuxer
    cmd.input(concatFilePath)
      .inputOptions(['-f', 'concat', '-safe', '0']);

    // Input 2: audio (if exists)
    if (audioPath && fs.existsSync(audioPath)) {
      cmd.input(audioPath);
    }

    cmd
      .videoCodec('libx264')
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${BRAND.bg.replace('#', '0x')}`,
      ]);

    if (audioPath && fs.existsSync(audioPath)) {
      cmd.audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions(['-shortest']); // End when audio ends
    }

    cmd.output(outputPath)
      .on('start', cmdLine => console.log(`[FFmpeg] Command: ${cmdLine.substring(0, 120)}...`))
      .on('progress', p => { if (p.percent) process.stdout.write(`\r[FFmpeg] Progress: ${Math.round(p.percent)}%`); })
      .on('end', () => {
        process.stdout.write('\n');
        // Clean up concat file
        try { fs.unlinkSync(concatFilePath); } catch (e) {}
        console.log(`[FFmpeg] ✅ Video saved: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        try { fs.unlinkSync(concatFilePath); } catch (e) {}
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

/**
 * Main export: render full video + Shorts from script + audio
 *
 * @param {Object} params
 * @param {string} params.script - Full script text
 * @param {string} params.title - Video title
 * @param {string} params.format - tutorial | breakdown | interview
 * @param {string} params.audioPath - Path to MP3 from ElevenLabs
 * @param {string} params.outputDir - Directory to save output videos (optional)
 * @returns {Object} { landscapePath, shortsPath, slideCount, totalDurationSecs }
 */
async function renderVideo(params) {
  const {
    script,
    title = 'TradeOps',
    format = 'tutorial',
    audioPath,
    outputDir = os.tmpdir(),
  } = params;

  if (!script) throw new Error('Script is required for video rendering.');

  const timestamp = Date.now();
  const tmpDir = path.join(os.tmpdir(), `tradeops_render_${timestamp}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`[VideoRenderer] Parsing script into slides...`);
  const slides = parseScriptToSlides(script, title, format);
  console.log(`[VideoRenderer] ${slides.length} slides generated`);

  // ── Landscape Slides (1920x1080) ──────────────────────────────────────────
  console.log(`[VideoRenderer] Rendering landscape slide images (1920x1080)...`);
  const landscapeImagePaths = [];
  for (let i = 0; i < slides.length; i++) {
    const imgPath = path.join(tmpDir, `slide_landscape_${i}.png`);
    renderSlideFrame(slides[i], 1920, 1080, imgPath);
    landscapeImagePaths.push(imgPath);
  }

  // ── Vertical Slides (1080x1920 for Shorts) ────────────────────────────────
  console.log(`[VideoRenderer] Rendering vertical slide images (1080x1920)...`);
  const verticalImagePaths = [];
  for (let i = 0; i < slides.length; i++) {
    const imgPath = path.join(tmpDir, `slide_vertical_${i}.png`);
    renderSlideFrame(slides[i], 1080, 1920, imgPath);
    verticalImagePaths.push(imgPath);
  }

  const slideDurations = slides.map(s => s.duration);

  // ── Render Landscape MP4 ──────────────────────────────────────────────────
  const landscapePath = path.join(outputDir, `tradeops_${timestamp}_landscape.mp4`);
  console.log(`[VideoRenderer] Rendering landscape MP4...`);
  await buildSlideVideo(landscapeImagePaths, slideDurations, audioPath, landscapePath, 1920, 1080);

  // ── Render Vertical Shorts MP4 ────────────────────────────────────────────
  // For Shorts: use first 60 seconds of audio (or full audio if <60s)
  const shortsPath = path.join(outputDir, `tradeops_${timestamp}_shorts.mp4`);
  console.log(`[VideoRenderer] Rendering vertical Shorts MP4...`);

  // Shorts use only the first few slides (hook + 2-3 key points), max 60s
  const shortsSlideCount = Math.min(slides.length, 5);
  const shortsSlides = verticalImagePaths.slice(0, shortsSlideCount);
  const shortsDurations = slideDurations.slice(0, shortsSlideCount).map(d => Math.min(d, 15));
  const totalShortsDuration = shortsDurations.reduce((a, b) => a + b, 0);

  await buildSlideVideo(shortsSlides, shortsDurations, audioPath, shortsPath, 1080, 1920);

  // Clean up temp slide images
  try {
    [...landscapeImagePaths, ...verticalImagePaths].forEach(p => { try { fs.unlinkSync(p); } catch (e) {} });
    fs.rmdirSync(tmpDir);
  } catch (e) {}

  const totalDurationSecs = slideDurations.reduce((a, b) => a + b, 0);

  console.log(`[VideoRenderer] ✅ Render complete`);
  console.log(`  Landscape: ${landscapePath}`);
  console.log(`  Shorts:    ${shortsPath}`);
  console.log(`  Duration:  ~${Math.round(totalDurationSecs / 60)}min full, ~${totalShortsDuration}s shorts`);

  return {
    landscapePath,
    shortsPath,
    slideCount: slides.length,
    totalDurationSecs,
    shortsDurationSecs: totalShortsDuration,
  };
}

module.exports = { renderVideo, parseScriptToSlides };

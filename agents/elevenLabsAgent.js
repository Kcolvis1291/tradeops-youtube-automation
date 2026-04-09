/**
 * TradeOps ElevenLabs TTS Agent
 * Converts script text to MP3 audio using ElevenLabs API (free tier compatible)
 *
 * Free tier: ~10,000 chars/month
 * Strategy: Strip bracketed stage directions, use Adam voice for TradeOps brand
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ELEVENLABS_API_BASE = 'api.elevenlabs.io';

// Adam voice — authoritative, direct. Matches TradeOps brand voice.
const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

const DEFAULT_VOICE_SETTINGS = {
  stability: 0.72,
  similarity_boost: 0.80,
  style: 0.25,
  use_speaker_boost: true,
};

/**
 * Strip stage directions and non-spoken content from script
 * [B-ROLL: ...], [LOWER THIRD: ...], [CUT TO:...], etc.
 */
function cleanScriptForTTS(script) {
  if (!script) return '';
  return script
    // Remove bracketed stage directions (non-greedy)
    .replace(/\[[^\]]{0,200}\]/g, '')
    // Remove section headers like [HOOK], [INTRO], etc. (already handled above)
    // Remove multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

/**
 * Split script into chunks that fit ElevenLabs' 5000 char limit per request
 * Splits on sentence boundaries to avoid mid-sentence cuts
 */
function splitIntoChunks(text, maxChars = 4800) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += ' ' + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

/**
 * Convert text to audio using ElevenLabs API
 * Returns a Buffer of MP3 audio data
 */
function textToSpeechChunk(text, voiceId, apiKey, voiceSettings = DEFAULT_VOICE_SETTINGS) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: voiceSettings,
      output_format: 'mp3_44100_128',
    });

    const options = {
      hostname: ELEVENLABS_API_BASE,
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errData = '';
        res.on('data', d => errData += d);
        res.on('end', () => {
          try { const parsed = JSON.parse(errData); reject(new Error(`ElevenLabs error ${res.statusCode}: ${parsed.detail?.message || errData}`)); }
          catch (e) { reject(new Error(`ElevenLabs error ${res.statusCode}: ${errData}`)); }
        });
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Get remaining character quota from ElevenLabs
 */
function getQuotaInfo(apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: ELEVENLABS_API_BASE,
      path: '/v1/user/subscription',
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            characterLimit: parsed.character_limit || 10000,
            characterCount: parsed.character_count || 0,
            remaining: (parsed.character_limit || 10000) - (parsed.character_count || 0),
          });
        } catch (e) { resolve({ characterLimit: 10000, characterCount: 0, remaining: 10000 }); }
      });
    });
    req.on('error', () => resolve({ characterLimit: 10000, characterCount: 0, remaining: 10000 }));
    req.end();
  });
}

/**
 * Main export: generate voiceover MP3 for a script
 *
 * @param {Object} params
 * @param {string} params.script - Full script text
 * @param {string} params.outputPath - Where to save the MP3 (optional; uses temp dir if not provided)
 * @param {string} params.voiceId - ElevenLabs voice ID (optional; defaults to Adam)
 * @param {string} params.apiKey - ElevenLabs API key (ELEVENLABS_API_KEY env var)
 * @param {Object} params.voiceSettings - Optional voice settings override
 * @returns {Object} { audioPath, charCount, chunks, durationEstimateSecs }
 */
async function generateVoiceover(params) {
  const {
    script,
    outputPath,
    voiceId = DEFAULT_VOICE_ID,
    apiKey = process.env.ELEVENLABS_API_KEY,
    voiceSettings = DEFAULT_VOICE_SETTINGS,
  } = params;

  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required. Set it in Railway environment variables.');
  if (!script) throw new Error('Script text is required for voiceover generation.');

  // Clean script — remove stage directions
  const cleanedScript = cleanScriptForTTS(script);
  if (!cleanedScript) throw new Error('No speakable text found in script after cleaning.');

  console.log(`[ElevenLabs] Script cleaned: ${cleanedScript.length} chars (original: ${script.length})`);

  // Check quota first
  try {
    const quota = await getQuotaInfo(apiKey);
    console.log(`[ElevenLabs] Quota: ${quota.remaining} chars remaining of ${quota.characterLimit}`);
    if (quota.remaining < cleanedScript.length) {
      console.warn(`[ElevenLabs] ⚠️ Low quota! Need ${cleanedScript.length} chars, have ${quota.remaining}. Proceeding anyway...`);
    }
  } catch (e) {
    console.warn(`[ElevenLabs] Could not check quota: ${e.message}`);
  }

  // Split into chunks if needed
  const textChunks = splitIntoChunks(cleanedScript);
  console.log(`[ElevenLabs] Generating audio in ${textChunks.length} chunk(s)...`);

  // Generate audio for each chunk
  const audioBuffers = [];
  for (let i = 0; i < textChunks.length; i++) {
    console.log(`[ElevenLabs] Chunk ${i + 1}/${textChunks.length} (${textChunks[i].length} chars)...`);
    const buffer = await textToSpeechChunk(textChunks[i], voiceId, apiKey, voiceSettings);
    audioBuffers.push(buffer);
    // Small delay between chunks to avoid rate limiting on free tier
    if (i < textChunks.length - 1) await new Promise(r => setTimeout(r, 500));
  }

  // Concatenate all audio buffers
  const combinedAudio = Buffer.concat(audioBuffers);

  // Write to file
  const finalPath = outputPath || path.join(os.tmpdir(), `tradeops_audio_${Date.now()}.mp3`);
  fs.writeFileSync(finalPath, combinedAudio);

  // Estimate duration: MP3 at 128kbps → ~1 minute per MB
  const fileSizeMB = combinedAudio.length / (1024 * 1024);
  const durationEstimateSecs = Math.round(fileSizeMB * 60);

  console.log(`[ElevenLabs] ✅ Audio saved: ${finalPath} (${(combinedAudio.length / 1024).toFixed(1)} KB, ~${durationEstimateSecs}s)`);

  return {
    audioPath: finalPath,
    charCount: cleanedScript.length,
    chunks: textChunks.length,
    fileSizeBytes: combinedAudio.length,
    durationEstimateSecs,
  };
}

module.exports = { generateVoiceover, cleanScriptForTTS, getQuotaInfo, DEFAULT_VOICE_ID, DEFAULT_VOICE_SETTINGS };

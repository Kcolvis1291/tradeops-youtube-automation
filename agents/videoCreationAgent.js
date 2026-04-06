/**
 * TradeOps Video Creation Agent
 * Maps scripts to production scenes and generates ElevenLabs voiceover settings
 */

const SCENE_TYPES = [
  'TitleCard',      // Opening with TradeOps branding
  'Hook',           // First 30–45 seconds — bold statement or stat
  'ProblemFrame',   // Establishing the pain point
  'StatHighlight',  // Full-screen key number or metric
  'SystemDiagram',  // Visual framework/process breakdown
  'BulletList',     // Animated points appearing one by one
  'StepByStep',     // Numbered steps with icons
  'CaseStudy',      // Real example callout
  'QuoteCard',      // Guest quote (interviews) or key insight
  'MistakesAlert',  // Common mistakes callout
  'ActionItems',    // This week's action steps
  'CTA',            // Systems Audit + related video end screen
];

// ElevenLabs voice settings optimized for TradeOps
const ELEVENLABS_VOICES = {
  host: {
    // Recommended: "Adam" or "Josh" — authoritative, direct male voice
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    voiceName: 'Adam',
    stability: 0.72,
    similarityBoost: 0.80,
    style: 0.25,
    speakingRate: 1.0,
    notes: 'Direct, confident, peer-to-peer — like a successful operator. NOT corporate. NOT salesy. Slight energy lift on action items and key insights.',
  },
  // For interview host questions (slightly more conversational)
  host_interview: {
    voiceId: 'pNInz6obpgDQGcFmaJgB',
    voiceName: 'Adam',
    stability: 0.68,
    similarityBoost: 0.78,
    style: 0.30,
    speakingRate: 0.97,
    notes: 'Slightly more relaxed for interview context — conversational, curious, engaged.',
  },
};

/**
 * Generate video production brief
 * @param {Object} params - { script, format, title, pillar }
 * @returns {Object}
 */
function generateProductionBrief(params) {
  const { script, format = 'solo', title, pillar = 'systemization' } = params;
  const voice = format === 'interview'
    ? ELEVENLABS_VOICES.host_interview
    : ELEVENLABS_VOICES.host;

  const sections = parseScriptSections(script);
  const scenes = mapSectionsToScenes(sections, format);

  return {
    channel: 'TradeOps',
    title,
    format,
    pillar,
    estimatedDuration: format === 'interview' ? '20–30 minutes' : '10–14 minutes',
    voiceoverSettings: {
      ...voice,
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      textNormalization: 'apply',
    },
    scenes,
    productionNotes: getProductionNotes(format, pillar),
    remotionConfig: {
      fps: 30,
      width: 1920,
      height: 1080,
      format: 'mp4',
      codec: 'h264',
      audioBitrate: '128k',
    },
    brandAssets: {
      primaryColor: '#F05A28',
      secondaryColor: '#1A1A1A',
      accentColor: '#FFFFFF',
      fontPrimary: 'Montserrat ExtraBold',
      fontBody: 'Montserrat Regular',
      logoFile: 'tradeops-logo-orange.png',
      lowerThirdText: 'TradeOps | tradeops.com',
    },
    generatedAt: new Date().toISOString(),
  };
}

function parseScriptSections(script) {
  if (!script) return [];
  const sectionRegex = /\[([A-Z_\s/]+)\]([\s\S]*?)(?=\[[A-Z_\s/]+\]|$)/g;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(script)) !== null) {
    sections.push({ label: match[1].trim(), content: match[2].trim() });
  }
  if (sections.length === 0) {
    sections.push({ label: 'MAIN', content: script });
  }
  return sections;
}

function mapSectionsToScenes(sections, format) {
  const scenes = [];
  let idx = 1;

  for (const section of sections) {
    const label = section.label.toUpperCase();
    let sceneType;

    if (label.includes('HOOK') || label.includes('COLD_OPEN')) sceneType = 'Hook';
    else if (label.includes('INTRO') || label.includes('HOST_INTRO') || label.includes('CONTEXT')) sceneType = 'ProblemFrame';
    else if (label.includes('SYSTEM') || label.includes('FRAMEWORK') || label.includes('DEEP_DIVE')) sceneType = 'SystemDiagram';
    else if (label.includes('PROOF') || label.includes('CASE') || label.includes('ORIGIN')) sceneType = 'CaseStudy';
    else if (label.includes('MISTAKE')) sceneType = 'MistakesAlert';
    else if (label.includes('ACTION') || label.includes('STEP')) sceneType = 'ActionItems';
    else if (label.includes('CTA')) sceneType = 'CTA';
    else if (label.includes('RAPID') || label.includes('QUOTE')) sceneType = 'QuoteCard';
    else if (label.includes('RESULT') || label.includes('NUMBER')) sceneType = 'StatHighlight';
    else if (label.includes('DISCLAIMER')) sceneType = 'QuoteCard';
    else sceneType = 'BulletList';

    const hasStats = /\$[\d,]+|[\d]+%|\d+x|\d+K|\d+M/.test(section.content);
    if (hasStats && sceneType === 'BulletList') sceneType = 'StatHighlight';

    const wordCount = section.content.split(' ').length;
    const estimatedSecs = Math.ceil(wordCount / 130 * 60);

    scenes.push({
      sceneNumber: idx++,
      type: sceneType,
      sectionLabel: section.label,
      script: section.content.substring(0, 600),
      estimatedDuration: `${estimatedSecs}s`,
      remotionComponent: `${sceneType}Scene`,
      bRollSuggestion: getBRollSuggestion(sceneType, section.label),
    });
  }
  return scenes;
}

function getBRollSuggestion(sceneType, label) {
  const suggestions = {
    Hook: 'Busy job site, contractor looking at phone/clipboard, crew working in background',
    ProblemFrame: 'Overwhelmed contractor at desk, stack of invoices, calendar chaos',
    SystemDiagram: 'Animated flowchart overlay, software screen recording (GHL/ServiceTitan/Jobber)',
    StatHighlight: 'Animated counter/number reveal, spreadsheet zoom-in',
    CaseStudy: 'Job site aerial shot, truck fleet, team meeting',
    MistakesAlert: 'Red X animations, frustrated contractor, before/after comparison',
    ActionItems: 'Checklist animation, calendar overlay, phone notification',
    CTA: 'End screen with TradeOps branding + two video thumbnail cards',
    QuoteCard: 'Clean text card with quote, speaker name, company type',
    BulletList: 'Animated bullets on brand-colored background',
  };
  return suggestions[sceneType] || 'Job site B-roll or animated system diagram';
}

function getProductionNotes(format, pillar) {
  const base = [
    'Color scheme: #1A1A1A backgrounds, #F05A28 orange accents, white text',
    'Lower-third: "TradeOps | tradeops.com" in all scenes with host on camera',
    'End screen: Two video cards + Subscribe button. Duration: 20 seconds.',
    'Info card: Add at ~20% runtime → link to Systems Audit (tradeops.com/audit)',
    'Intro music: Industrial/modern, low energy fade-out by 3 seconds',
  ];

  const formatNotes = {
    solo: [
      'Host on camera for Hook, Context, Action Steps, and CTA sections minimum',
      'Screen recordings for any software demos (GHL, ServiceTitan, etc.)',
      'B-roll of job sites, trucks, crew for system/framework sections',
    ],
    interview: [
      'Two-camera setup: host left, guest right — or single camera with split editing',
      'Guest intro card: Name, Trade, Revenue Range, Key Achievement',
      'Text pull quotes for best guest soundbites (overlay cards)',
      'Chapter markers enabled — interviews benefit most from navigation',
    ],
  };

  const pillarNotes = {
    ghl_for_contractors: ['Screen record all GHL demos — capture actual interface for authenticity'],
    job_costing: ['Show actual spreadsheet or software — real numbers, real formulas'],
    field_service_management: ['Software demo clips essential — Jobber, ServiceTitan, HCP'],
    financial_management: ['Blurred/example financial statements add credibility as B-roll'],
  };

  return [
    ...base,
    ...(formatNotes[format] || []),
    ...(pillarNotes[pillar] || []),
  ];
}

module.exports = { generateProductionBrief, ELEVENLABS_VOICES, SCENE_TYPES };

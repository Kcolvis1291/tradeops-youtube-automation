/**
 * TradeOps Manager / QA Agent — v2 (Education-First Strategy)
 *
 * QA criteria updated for education-first, how-to implementation content.
 * Every piece of content must pass the "can a contractor actually BUILD THIS from watching?" test.
 * Done-for-you CTA (tradeops.com) must be present — NOT systems audit framing.
 */

const { screenContent, autoFixDescription } = require('./complianceScreener');

const QA_DIMENSIONS = [
  'research_quality',        // Topic well-targeted to a specific pillar and competitor gap?
  'implementation_depth',    // Does the script actually teach HOW TO build the system?
  'seo_optimization',        // Title leads with how-to intent, tags are pillar-specific?
  'compliance',              // Disclaimer present? No overclaims?
  'thumbnail_quality',       // A/B concepts on-brand, outcome/system-focused?
  'video_brief_quality',     // Production scenes mapped?
  'publish_readiness',       // All assets assembled?
  'brand_cta',               // Done-for-you CTA (tradeops.com) present — NOT "systems audit"?
];

const MIN_SCORES = {
  research_quality: 70,
  implementation_depth: 88,   // Highest bar — this is the core differentiator
  seo_optimization: 72,
  compliance: 80,
  thumbnail_quality: 70,
  video_brief_quality: 65,
  publish_readiness: 75,
  brand_cta: 85,              // Done-for-you CTA is non-negotiable
};

/**
 * Run full QA
 * @param {Object} contentPackage
 * @returns {Object} QA report
 */
function runQA(contentPackage) {
  const scores = {};
  const issues = [];
  const recommendations = [];

  // 1. Research quality
  scores.research_quality = scoreResearch(contentPackage.research);
  if (scores.research_quality < MIN_SCORES.research_quality) {
    issues.push({ dimension: 'research_quality', detail: 'Research brief lacks pillar depth or competitor gap framing' });
    recommendations.push('Re-run research with specific pillar and competitor gap context');
  }

  // 2. Implementation depth — THE key differentiator
  scores.implementation_depth = scoreImplementationDepth(contentPackage.script, contentPackage.format);
  if (scores.implementation_depth < MIN_SCORES.implementation_depth) {
    issues.push({
      dimension: 'implementation_depth',
      detail: `Script score ${contentPackage.scriptQaScore} — insufficient HOW-TO depth. A contractor should be able to PAUSE and IMPLEMENT during this video.`,
    });
    recommendations.push('Regenerate script — needs more specific steps, tool names, real numbers, and actionable workflow details');
  }

  // 3. SEO optimization
  scores.seo_optimization = scoreSEO(contentPackage.seo);
  if (scores.seo_optimization < MIN_SCORES.seo_optimization) {
    issues.push({ dimension: 'seo_optimization', detail: 'SEO metadata missing how-to intent framing or pillar-specific tags' });
  }

  // 4. Compliance
  const complianceResult = screenContent({
    title: contentPackage.seo?.title,
    script: contentPackage.script,
    description: contentPackage.seo?.description,
    tags: contentPackage.seo?.tags,
  });
  scores.compliance = complianceResult.score;
  if (!complianceResult.pass) {
    issues.push({ dimension: 'compliance', detail: 'Content failed compliance screen', complianceIssues: complianceResult.issues });
    recommendations.push('Auto-fixing: appending required disclaimers');
    if (contentPackage.seo && complianceResult.requiredAdditions.length > 0) {
      contentPackage.seo.description = autoFixDescription(
        contentPackage.seo.description || '',
        complianceResult.requiredAdditions
      );
    }
  }

  // 5. Thumbnail quality
  scores.thumbnail_quality = contentPackage.thumbnails?.conceptA && contentPackage.thumbnails?.conceptB ? 88 : 48;
  if (scores.thumbnail_quality < MIN_SCORES.thumbnail_quality) {
    issues.push({ dimension: 'thumbnail_quality', detail: 'A/B thumbnail concepts missing or incomplete' });
  }

  // 6. Video brief quality
  scores.video_brief_quality = contentPackage.videoBrief?.scenes?.length >= 3 ? 85 : 52;

  // 7. Publish readiness
  scores.publish_readiness = scorePublishReadiness(contentPackage);
  if (scores.publish_readiness < MIN_SCORES.publish_readiness) {
    issues.push({ dimension: 'publish_readiness', detail: 'Missing key publish assets' });
  }

  // 8. Brand CTA — done-for-you framing check
  scores.brand_cta = scoreBrandCTA(contentPackage);
  if (scores.brand_cta < MIN_SCORES.brand_cta) {
    issues.push({
      dimension: 'brand_cta',
      detail: 'Missing done-for-you CTA (tradeops.com). Check: script [DONE-FOR-YOU CTA] section and description.',
    });
    recommendations.push('Ensure done-for-you CTA is present: "Visit tradeops.com" with DFY positioning — not "book a systems audit"');
  }

  const overallScore = Math.round(
    Object.values(scores).reduce((a, b) => a + b, 0) / QA_DIMENSIONS.length
  );

  const criticalFail = scores.implementation_depth < MIN_SCORES.implementation_depth ||
    scores.brand_cta < MIN_SCORES.brand_cta ||
    (scores.compliance < 80 && !complianceResult.pass);

  const passed = overallScore >= 75 && !criticalFail;

  return {
    channel: 'TradeOps',
    videoTitle: contentPackage.seo?.title,
    format: contentPackage.format || 'tutorial',
    pillar: contentPackage.pillar,
    overallScore,
    passed,
    scores,
    issues,
    recommendations,
    complianceResult,
    readyForPublish: passed,
    implementationTest: scores.implementation_depth >= MIN_SCORES.implementation_depth
      ? '✅ Viewer can pause and implement'
      : '❌ Not deep enough — rebuild script',
    qaTimestamp: new Date().toISOString(),
  };
}

function scoreResearch(research) {
  if (!research) return 45;
  let score = 60;
  if (research.topTopics?.length >= 3) score += 10;
  if (research.recommendedVideo) score += 10;
  if (research.pillar) score += 8;
  if (research.competitorGap) score += 7;
  if (research.recommendedVideo?.outline?.length >= 4) score += 5;
  return Math.min(100, score);
}

function scoreImplementationDepth(script, format) {
  if (!script) return 30;
  let score = 55;

  // Check for step-by-step structure
  const hasNumberedSteps = /step [1-9]|step one|step two|\[step/i.test(script);
  if (hasNumberedSteps) score += 12;

  // Check for real tool mentions
  const hasToolMentions = /gohighlevel|ghl|servicetitan|jobber|housecall pro|quickbooks|loom|servicem8/i.test(script);
  if (hasToolMentions) score += 8;

  // Check for real numbers
  const hasRealNumbers = /\$[\d,]+|[\d]+%|\d+ hours|\d+ minutes|\d+ steps|\d+ days/i.test(script);
  if (hasRealNumbers) score += 8;

  // Check for how-to sections
  const hasHowToSections = /\[THE SYSTEM|\[STEP|\[WHAT YOU'LL BUILD|\[FRAMEWORK|\[BUILDING/i.test(script);
  if (hasHowToSections) score += 10;

  // Check for done-for-you CTA (not systems audit)
  const hasDFYCta = /tradeops\.com|done for you|built for you/i.test(script);
  const hasOldCta = /systems audit|book a free audit/i.test(script);
  if (hasDFYCta && !hasOldCta) score += 7;
  if (hasOldCta) score -= 15; // Penalize old CTA framing

  return Math.min(100, score);
}

function scoreSEO(seo) {
  if (!seo) return 40;
  let score = 52;
  if (seo.title && seo.title.length <= 65) score += 8;
  if (/^how to/i.test(seo.title || '')) score += 10; // HOW-TO title bonus
  if (seo.description && seo.description.length >= 300) score += 8;
  if (seo.tags && seo.tags.length >= 8) score += 8;
  if (seo.chapterTimestamps?.length >= 5) score += 7;
  if (seo.description?.toLowerCase().includes('tradeops.com')) score += 7;
  return Math.min(100, score);
}

function scorePublishReadiness(pkg) {
  let score = 38;
  if (pkg.script) score += 12;
  if (pkg.seo?.title) score += 10;
  if (pkg.seo?.description) score += 10;
  if (pkg.seo?.tags?.length >= 8) score += 10;
  if (pkg.thumbnails?.conceptA) score += 10;
  if (pkg.videoBrief) score += 10;
  return Math.min(100, score);
}

function scoreBrandCTA(pkg) {
  let score = 40;
  const scriptText = (pkg.script || '').toLowerCase();
  const descText = (pkg.seo?.description || '').toLowerCase();
  const combined = scriptText + ' ' + descText;

  // Done-for-you CTA check
  const hasDFYCta = combined.includes('tradeops.com') || combined.includes('done for you') || combined.includes('built for you');
  if (hasDFYCta) score += 35;

  // Penalize old systems audit framing
  const hasOldCta = combined.includes('systems audit') || combined.includes('book a free audit');
  if (hasOldCta) score -= 25;

  // Watch next link check
  const hasWatchNext = combined.includes('watch next') || combined.includes('watch this next');
  if (hasWatchNext) score += 15;

  // Resource link check
  const hasResourceLink = combined.includes('tradeops.com/resources') || combined.includes('implementation guide') || combined.includes('free');
  if (hasResourceLink) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Pipeline status summary
 */
function getPipelineSummary(jobs = []) {
  const summary = {
    totalJobs: jobs.length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    inProgress: jobs.filter(j => j.status === 'running').length,
    pending: jobs.filter(j => j.status === 'pending').length,
    avgQaScore: 0,
    tutorialCount: jobs.filter(j => j.format === 'tutorial').length,
    breakdownCount: jobs.filter(j => j.format === 'breakdown').length,
    interviewCount: jobs.filter(j => j.format === 'interview').length,
    lastRun: jobs[jobs.length - 1]?.startedAt || 'Never',
  };
  const scoredJobs = jobs.filter(j => j.qaScore);
  if (scoredJobs.length) {
    summary.avgQaScore = Math.round(scoredJobs.reduce((a, j) => a + j.qaScore, 0) / scoredJobs.length);
  }
  return summary;
}

module.exports = { runQA, getPipelineSummary, QA_DIMENSIONS, MIN_SCORES };

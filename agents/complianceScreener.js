/**
 * TradeOps Compliance Screener — v2
 * Screens for YouTube TOS, FTC disclosure, and business results disclaimers.
 * Also flags the OLD "systems audit" CTA if it slips through — enforces DFY positioning.
 */

const REQUIRED_DISCLAIMERS = {
  business_results: [
    'Results discussed are illustrative examples. Individual business outcomes vary based on market conditions, team, and execution.',
    'Nothing in this video constitutes legal, financial, or business consulting advice.',
  ],
  interview: [
    'Guest results are their own and are not a guarantee of what you will achieve.',
    'Always consult qualified professionals before making significant business decisions.',
  ],
};

const PROHIBITED_PHRASES = [
  'guaranteed revenue',
  'guaranteed results',
  'guaranteed to work',
  'get rich quick',
  'make money fast',
  'overnight success',
  'effortless income',
  '100% success rate',
  'you will definitely make',
  'this will always work',
  'risk free',
];

const YELLOW_FLAG_PHRASES = [
  'always works',
  'never fails',
  'instant results',
  'doubles revenue overnight',
  'guaranteed profit',
];

// CTA enforcement — old framing must not appear
const DEPRECATED_CTA_PHRASES = [
  'book a free systems audit',
  'book a systems audit',
  'tradeops.com/audit',
  'free systems audit',
];

/**
 * Screen content for compliance and CTA issues
 * @param {Object} content - { title, script, description, tags }
 * @returns {Object}
 */
function screenContent(content) {
  const issues = [];
  const requiredAdditions = [];
  let deductions = 0;

  const fullText = [
    content.title || '',
    content.script || '',
    content.description || '',
    (content.tags || []).join(' '),
  ].join(' ').toLowerCase();

  // Check prohibited phrases
  for (const phrase of PROHIBITED_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      issues.push({ severity: 'HIGH', rule: 'FTC / YouTube TOS', detail: `Prohibited phrase: "${phrase}" — remove or reframe` });
      deductions += 20;
    }
  }

  // Check yellow flags
  for (const phrase of YELLOW_FLAG_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      issues.push({ severity: 'MEDIUM', rule: 'Results overclaim', detail: `Overconfident phrasing: "${phrase}"` });
      deductions += 8;
    }
  }

  // Flag old CTA framing
  for (const phrase of DEPRECATED_CTA_PHRASES) {
    if (fullText.includes(phrase.toLowerCase())) {
      issues.push({
        severity: 'MEDIUM',
        rule: 'Brand CTA',
        detail: `Deprecated CTA found: "${phrase}". Replace with done-for-you framing: "Visit tradeops.com"`,
      });
      deductions += 10;
    }
  }

  // Check for required disclaimers
  const hasResultsDisclaimer = fullText.includes('results vary') || fullText.includes('individual') || fullText.includes('illustrative') || fullText.includes('outcomes vary');
  const hasDFYCta = fullText.includes('tradeops.com') && !fullText.includes('tradeops.com/audit');
  const hasWatchNext = fullText.includes('watch next');

  if (!hasResultsDisclaimer) {
    requiredAdditions.push(...REQUIRED_DISCLAIMERS.business_results);
    issues.push({ severity: 'MEDIUM', rule: 'FTC', detail: 'Missing business results disclaimer' });
    deductions += 10;
  }

  if (!hasDFYCta) {
    issues.push({ severity: 'LOW', rule: 'Brand', detail: 'Missing done-for-you CTA (tradeops.com)' });
    deductions += 5;
  }

  const score = Math.max(0, 100 - deductions);
  const pass = score >= 80 && issues.filter(i => i.severity === 'HIGH').length === 0;

  return { pass, score, issues, requiredAdditions, hasResultsDisclaimer, hasDFYCta, hasWatchNext };
}

function autoFixDescription(description, disclaimers) {
  if (!disclaimers || disclaimers.length === 0) return description;
  const alreadyHas = disclaimers.every(d =>
    description.toLowerCase().includes(d.substring(0, 30).toLowerCase())
  );
  if (alreadyHas) return description;
  return description + '\n\n' + disclaimers.join('\n');
}

module.exports = { screenContent, autoFixDescription, REQUIRED_DISCLAIMERS };

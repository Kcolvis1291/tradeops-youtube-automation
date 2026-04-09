/**
 * TradeOps Publishing Agent — v2 (Education-First Strategy)
 *
 * PUBLISHING CALENDAR:
 *   Tuesday 7pm ET  — Tutorial (HOW-TO system build)
 *   Thursday 7pm ET — Breakdown (concept deep-dive with real numbers)
 *   Friday 7pm ET   — Interview (operator case study — bi-weekly)
 *
 * Competitor benchmark:
 *   Profitable Tradie  → 2x podcast/week (no consistent YouTube schedule)
 *   Profit for Contractors → 1x podcast/week Wednesday
 *   TradeOps target: 2x/week YouTube with optional interview every 2 weeks = ~10 videos/month
 *
 * Best times for trades business owners: Evenings (7–9pm ET) when they're off the job site.
 * Tuesday and Thursday avoid podcast competition (Wed = Profit for Contractors).
 */

const PUBLISH_SCHEDULE = {
  tutorial: {
    days: ['Tuesday'],
    time: '19:00',
    timezone: 'America/New_York',
    videosPerWeek: 1,
    description: 'HOW-TO system build tutorials — step-by-step implementation',
    note: 'Primary content type. Every Tuesday. Operators wind down Tuesday evening.',
  },
  breakdown: {
    days: ['Thursday'],
    time: '19:00',
    timezone: 'America/New_York',
    videosPerWeek: 1,
    description: 'Concept breakdowns with real numbers — deeper education',
    note: 'Thursday evening before Friday. Contractors planning weekend admin time.',
  },
  interview: {
    days: ['Friday'],
    time: '19:00',
    timezone: 'America/New_York',
    videosPerWeek: 0.5,
    description: 'Operator case study interviews — bbi-weekly (every other Friday)',
    note: 'Bi-weekly. Friday end-of-week longer watch session. Longer format OK.',
  },
};

// 12-week rolling content calendar
const PILLAR_ROTATION = [
  // Week 1
  { week: 1, tuesday: { pillar: 'job_costing', format: 'tutorial' }, thursday: { pillar: 'job_costing', format: 'breakdown' } },
  // Week 2
  { week: 2, tuesday: { pillar: 'scheduling_systems', format: 'tutorial' }, thursday: { pillar: 'scheduling_systems', format: 'breakdown' }, friday: { pillar: 'owner_independence', format: 'interview' } },
  // Week 3
  { week: 3, tuesday: { pillar: 'owner_independence', format: 'tutorial' }, thursday: { pillar: 'owner_independence', format: 'breakdown' } },
  // Week 4
  { week: 4, tuesday: { pillar: 'hiring_systems', format: 'tutorial' }, thursday: { pillar: 'hiring_systems', format: 'breakdown' }, friday: { pillar: 'hiring_systems', format: 'interview' } },
  // Week 5
  { week: 5, tuesday: { pillar: 'kpi_tracking', format: 'tutorial' }, thursday: { pillar: 'kpi_tracking', format: 'breakdown' } },
  // Week 6
  { week: 6, tuesday: { pillar: 'ghl_for_contractors', format: 'tutorial' }, thursday: { pillar: 'ghl_for_contractors', format: 'breakdown' }, friday: { pillar: 'ghl_for_contractors', format: 'interview' } },
  // Week 7
  { week: 7, tuesday: { pillar: 'sop_systems', format: 'tutorial' }, thursday: { pillar: 'sop_systems', format: 'breakdown' } },
  // Week 8
  { week: 8, tuesday: { pillar: 'financial_systems', format: 'tutorial' }, thursday: { pillar: 'financial_systems', format: 'breakdown' }, friday: { pillar: 'job_costing', format: 'interview' } },
  // Week 9 — repeat cycle with new topics
  { week: 9, tuesday: { pillar: 'job_costing', format: 'tutorial' }, thursday: { pillar: 'scheduling_systems', format: 'breakdown' } },
  { week: 10, tuesday: { pillar: 'owner_independence', format: 'tutorial' }, thursday: { pillar: 'kpi_tracking', format: 'breakdown' }, friday: { pillar: 'sop_systems', format: 'interview' } },
  { week: 11, tuesday: { pillar: 'hiring_systems', format: 'tutorial' }, thursday: { pillar: 'ghl_for_contractors', format: 'breakdown' } },
  { week: 12, tuesday: { pillar: 'financial_systems', format: 'tutorial' }, thursday: { pillar: 'sop_systems', format: 'breakdown' }, friday: { pillar: 'financial_systems', format: 'interview' } },
];

const DAY_MAP = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

/**
 * Get next publish slot for a given format
 * @param {string} format - 'tutorial' | 'breakdown' | 'interview' | 'any'
 */
function getNextPublishTime(format = 'any') {
  const now = new Date();
  const slots = [];

  const schedules = format === 'any'
    ? Object.entries(PUBLISH_SCHEDULE)
    : [[format, PUBLISH_SCHEDULE[format] || PUBLISH_SCHEDULE.tutorial]];

  for (const [fmt, schedule] of schedules) {
    const [schedHour, schedMin] = schedule.time.split(':').map(Number);
    for (const day of schedule.days) {
      const targetDay = DAY_MAP[day];
      let diff = targetDay - now.getDay();
      if (diff < 0) diff += 7;
      if (diff === 0) {
        const todayScheduled = new Date(now);
        todayScheduled.setHours(schedHour, schedMin, 0, 0);
        if (now >= todayScheduled) diff = 7;
      }
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + diff);
      nextDate.setHours(schedHour, schedMin, 0, 0);
      slots.push({
        format: fmt,
        date: nextDate,
        dayName: day,
        daysUntil: diff,
        formattedTime: `${day} at ${schedule.time} ET`,
        isoString: nextDate.toISOString(),
        description: schedule.description,
      });
    }
  }

  slots.sort((a, b) => a.date - b.date);
  return slots[0] || null;
}

/**
 * Get publish queue status
 */
function getPublishQueue(contentQueue = []) {
  const ready = contentQueue.filter(c => c.status === 'ready');
  const needsReview = contentQueue.filter(c => c.status === 'needs_review');

  return {
    channel: 'TradeOps',
    summary: {
      totalReady: ready.length,
      needsReview: needsReview.length,
      tutorialReady: ready.filter(c => c.format === 'tutorial').length,
      breakdownReady: ready.filter(c => c.format === 'breakdown').length,
      interviewReady: ready.filter(c => c.format === 'interview').length,
      queueHealth: ready.length >= 4 ? 'Healthy' : ready.length >= 2 ? 'Low' : 'Empty',
    },
    nextPublish: {
      tutorial: getNextPublishTime('tutorial'),
      breakdown: getNextPublishTime('breakdown'),
      interview: getNextPublishTime('interview'),
    },
    schedule: PUBLISH_SCHEDULE,
    competitorContext: {
      profitableTradie: 'No consistent YouTube schedule — they rely on podcast',
      profitForContractors: 'Wednesday podcast — TradeOps Tuesday/Thursday avoids direct competition',
      serviceTitan: 'Product demos only — not competing for same audience intent',
    },
  };
}

/**
 * Generate YouTube Studio upload checklist
 */
function generateUploadChecklist(contentPackage) {
  const { title, description, tags, format = 'tutorial' } = contentPackage;
  const nextPublish = getNextPublishTime(format);
  const isInterview = format === 'interview';

  return {
    channel: 'TradeOps',
    title,
    format,
    uploadSteps: [
      '1. YouTube Studio → Create → Upload videos',
      '2. Select rendered 1080p video file',
      `3. Title: "${title}"`,
      '4. Paste full description (includes free resource link + done-for-you CTA + watch next)',
      '5. Add all tags from SEO package',
      `6. Upload Thumbnail Concept A (A/B test — check CTR after 5 days)`,
      '7. Category: Education',
      '8. Enable automatic chapters (timestamps must be in description)',
      `9. Playlist: ${isInterview ? '"Operator Case Studies"' : format === 'breakdown' ? '"Deep Dives"' : '"How-To Tutorials"'}`,
      `10. Schedule: ${nextPublish?.formattedTime || 'Next available slot'}`,
      '11. End screen: Add 2 video cards (20 sec) — related video + subscribe',
      '12. Info card at 25% runtime → tradeops.com/resources link',
      '13. Auto-captions: enable + review accuracy',
      '14. Audience: Not made for kids',
      '15. AFTER PUBLISH: Pin comment (from SEO package) immediately',
      '16. AFTER PUBLISH: Share to TradeOps social within 1 hour',
      '17. AFTER PUBLISH: Add free resource link to description if not already included',
    ],
    scheduledFor: nextPublish?.formattedTime,
    checklist: {
      titleUnder65Chars: (title || '').length <= 65,
      titleStartsWithHowTo: /^how to/i.test(title || ''),
      hasDescription: (description || '').length > 200,
      hasTags: (tags || []).length >= 8,
      hasDFYCta: (description || '').toLowerCase().includes('tradeops.com'),
      hasWatchNext: (description || '').includes('WATCH NEXT'),
      hasResourceLink: (description || '').includes('tradeops.com/resources'),
      hasDisclaimer: (description || '').includes('results vary') || (description || '').includes('illustrative'),
      thumbnailReady: false,
      videoRendered: false,
      endScreenSet: false,
    },
  };
}

/**
 * Get the 12-week content calendar
 */
function getContentCalendar() {
  return { calendar: PILLAR_ROTATION, publishSchedule: PUBLISH_SCHEDULE };
}

module.exports = { getNextPublishTime, getPublishQueue, generateUploadChecklist, getContentCalendar, PUBLISH_SCHEDULE, PILLAR_ROTATION };

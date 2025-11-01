import { NextRequest, NextResponse } from 'next/server';
import { scrapeMultipleProfiles, LinkedInProfile, ScrapedResult } from '@/lib/linkedinScraper';
import { scoreCandidate, HackathonEvaluation, ScoringResult } from '@/lib/openaiScorer';

// Extended attendee interface with LinkedIn data and OpenAI scoring
interface EnrichedAttendee {
  name: string;
  profileUrl: string;
  eventsAttended: number;
  instagram: string;
  x: string;
  tiktok: string;
  linkedin: string;
  website: string;

  // LinkedIn enrichment data
  linkedinData: LinkedInProfile | null;
  scrapingStatus: 'pending' | 'completed' | 'failed' | 'no_linkedin';
  scrapingError?: string;

  // OpenAI scoring data
  hackathons_won: number | string | null;
  technical_skill: number | null;
  technical_skill_summary: string | null;
  collaboration: number | null;
  collaboration_summary: string | null;
  overall_score: number | null;
  summary: string | null;
  scoringStatus: 'pending' | 'completed' | 'failed' | 'skipped';
  scoringError?: string;
}

interface StoredData {
  attendees: EnrichedAttendee[];
  eventUrl: string;
  timestamp: string;
  count: number;
  scrapingProgress: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
  };
  scoringProgress: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    skipped: number;
  };
}

// In-memory storage for attendee data
let storedAttendees: StoredData = {
  attendees: [],
  eventUrl: '',
  timestamp: '',
  count: 0,
  scrapingProgress: {
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
  },
  scoringProgress: {
    total: 0,
    completed: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
  },
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate that we received attendee data
    if (!data.attendees || !Array.isArray(data.attendees)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected { attendees: [...] }' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Transform attendees to enriched format with LinkedIn and scoring placeholders
    const enrichedAttendees: EnrichedAttendee[] = data.attendees.map((attendee: any) => ({
      ...attendee,
      linkedinData: null,
      scrapingStatus: attendee.linkedin ? 'pending' : 'no_linkedin',
      // Initialize scoring fields
      hackathons_won: null,
      technical_skill: null,
      technical_skill_summary: null,
      collaboration: null,
      collaboration_summary: null,
      overall_score: null,
      summary: null,
      scoringStatus: 'pending',
    }));

    // Count how many have LinkedIn URLs
    const linkedinCount = enrichedAttendees.filter(a => a.linkedin).length;

    // Store the attendees with metadata
    storedAttendees = {
      attendees: enrichedAttendees,
      eventUrl: data.eventUrl || '',
      timestamp: new Date().toISOString(),
      count: enrichedAttendees.length,
      scrapingProgress: {
        total: linkedinCount,
        completed: 0,
        pending: linkedinCount,
        failed: 0,
      },
      scoringProgress: {
        total: linkedinCount,
        completed: 0,
        pending: linkedinCount,
        failed: 0,
        skipped: 0,
      },
    };

    console.log(`Received ${data.attendees.length} attendees from ${data.eventUrl || 'unknown event'}`);
    console.log(`Starting LinkedIn scraping for ${linkedinCount} profiles...`);

    // Start background LinkedIn scraping (don't await)
    if (linkedinCount > 0) {
      startLinkedInScraping().catch(error => {
        console.error('Background LinkedIn scraping failed:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully stored ${data.attendees.length} attendees`,
      count: data.attendees.length,
      linkedinScrapingStarted: linkedinCount > 0,
      linkedinProfilesQueued: linkedinCount,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing attendee data:', error);
    return NextResponse.json(
      { error: 'Failed to process attendee data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET() {
  // Return stored attendees for the dashboard
  return NextResponse.json(storedAttendees, { headers: corsHeaders });
}

/**
 * Background function to scrape LinkedIn profiles
 */
async function startLinkedInScraping() {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;

  if (!apiKey) {
    console.error('SCRAPINGDOG_API_KEY not found in environment variables');
    // Mark all as failed
    storedAttendees.attendees.forEach(attendee => {
      if (attendee.scrapingStatus === 'pending') {
        attendee.scrapingStatus = 'failed';
        attendee.scrapingError = 'API key not configured';
      }
    });
    storedAttendees.scrapingProgress.failed = storedAttendees.scrapingProgress.total;
    storedAttendees.scrapingProgress.pending = 0;
    return;
  }

  // Extract LinkedIn URLs with their indices
  const linkedinUrls: Array<{ url: string; index: number }> = [];
  storedAttendees.attendees.forEach((attendee, index) => {
    if (attendee.linkedin && attendee.scrapingStatus === 'pending') {
      linkedinUrls.push({ url: attendee.linkedin, index });
    }
  });

  if (linkedinUrls.length === 0) {
    console.log('No LinkedIn URLs to scrape');
    return;
  }

  // Scrape profiles with progress tracking
  await scrapeMultipleProfiles(
    linkedinUrls.map(item => item.url),
    apiKey,
    (completed, total, lastResult: ScrapedResult) => {
      // Find the attendee index for this URL
      const urlItem = linkedinUrls.find(item => item.url === lastResult.url);
      if (!urlItem) return;

      const attendee = storedAttendees.attendees[urlItem.index];

      if (lastResult.success && lastResult.data) {
        // Successfully scraped - update with LinkedIn data
        attendee.linkedinData = lastResult.data;
        attendee.scrapingStatus = 'completed';
        storedAttendees.scrapingProgress.completed++;
      } else {
        // Failed - mark as failed with error
        attendee.scrapingStatus = 'failed';
        attendee.scrapingError = lastResult.error || 'Unknown error';
        storedAttendees.scrapingProgress.failed++;
      }

      storedAttendees.scrapingProgress.pending--;

      console.log(
        `LinkedIn scraping progress: ${completed}/${total} ` +
        `(✓ ${storedAttendees.scrapingProgress.completed} / ✗ ${storedAttendees.scrapingProgress.failed})`
      );
    }
  );

  console.log('LinkedIn scraping completed!');
  console.log(`Results: ${storedAttendees.scrapingProgress.completed} successful, ${storedAttendees.scrapingProgress.failed} failed`);

  // Start OpenAI scoring after LinkedIn scraping completes
  console.log('Starting OpenAI scoring...');
  startOpenAIScoring().catch(error => {
    console.error('Background OpenAI scoring failed:', error);
  });
}

/**
 * Background function to score candidates with OpenAI
 * Runs after LinkedIn scraping completes
 */
async function startOpenAIScoring() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    // Mark all as skipped
    storedAttendees.attendees.forEach(attendee => {
      if (attendee.scoringStatus === 'pending') {
        attendee.scoringStatus = 'skipped';
        attendee.scoringError = 'OpenAI API key not configured';
      }
    });
    storedAttendees.scoringProgress.skipped = storedAttendees.scoringProgress.total;
    storedAttendees.scoringProgress.pending = 0;
    return;
  }

  // Find attendees with successfully scraped LinkedIn data
  const attendeesToScore: Array<{ attendee: EnrichedAttendee; index: number }> = [];

  storedAttendees.attendees.forEach((attendee, index) => {
    if (attendee.scrapingStatus === 'completed' && attendee.linkedinData && attendee.scoringStatus === 'pending') {
      attendeesToScore.push({ attendee, index });
    } else if (attendee.scrapingStatus !== 'completed' && attendee.scoringStatus === 'pending') {
      // Skip scoring for attendees without LinkedIn data
      attendee.scoringStatus = 'skipped';
      storedAttendees.scoringProgress.skipped++;
      storedAttendees.scoringProgress.pending--;
    }
  });

  if (attendeesToScore.length === 0) {
    console.log('No attendees to score (no successfully scraped LinkedIn profiles)');
    return;
  }

  console.log(`Scoring ${attendeesToScore.length} candidates with OpenAI in parallel...`);

  // Score all candidates in parallel (much faster!)
  const scoringPromises = attendeesToScore.map(async ({ attendee, index }) => {
    console.log(`Started scoring: ${attendee.name}`);

    try {
      const result: ScoringResult = await scoreCandidate(attendee.linkedinData!);

      if (result.success && result.evaluation) {
        // Successfully scored - update with all scoring fields
        const evaluation = result.evaluation;
        attendee.hackathons_won = evaluation.hackathons_won;
        attendee.technical_skill = evaluation.technical_skill;
        attendee.technical_skill_summary = evaluation.technical_skill_summary;
        attendee.collaboration = evaluation.collaboration;
        attendee.collaboration_summary = evaluation.collaboration_summary;
        attendee.overall_score = evaluation.overall_score;
        attendee.summary = evaluation.summary;
        attendee.scoringStatus = 'completed';

        storedAttendees.scoringProgress.completed++;
        storedAttendees.scoringProgress.pending--;
        console.log(`✓ Scored ${attendee.name}: ${evaluation.overall_score}/100 (Tech: ${evaluation.technical_skill}, Collab: ${evaluation.collaboration})`);
      } else {
        // Failed to score
        attendee.scoringStatus = 'failed';
        attendee.scoringError = result.error || 'Unknown scoring error';
        storedAttendees.scoringProgress.failed++;
        storedAttendees.scoringProgress.pending--;
        console.log(`✗ Failed to score ${attendee.name}: ${result.error}`);
      }
    } catch (error) {
      attendee.scoringStatus = 'failed';
      attendee.scoringError = error instanceof Error ? error.message : 'Unknown error';
      storedAttendees.scoringProgress.failed++;
      storedAttendees.scoringProgress.pending--;
      console.log(`✗ Error scoring ${attendee.name}:`, error);
    }
  });

  // Wait for all scoring requests to complete
  await Promise.all(scoringPromises);

  console.log('OpenAI scoring completed!');
  console.log(
    `Results: ${storedAttendees.scoringProgress.completed} scored, ` +
    `${storedAttendees.scoringProgress.failed} failed, ` +
    `${storedAttendees.scoringProgress.skipped} skipped`
  );
}

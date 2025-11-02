import { NextRequest, NextResponse } from 'next/server';
import { scrapeMultipleProfiles, LinkedInProfile, ScrapedResult } from '@/lib/linkedinScraper';
import { scoreMultipleCandidatesParallel, HackathonEvaluation, ScoringResult } from '@/lib/openaiScorer';
import { dataStore, type StoredData, type EnrichedAttendee } from '@/lib/dataStore';

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
    console.log('🔵 POST /api/attendees - Receiving data...');
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
      overall_score: null,
      technical_skill_summary: null,
      collaboration_summary: null,
      summary: null,
      scoringStatus: 'pending',
    }));

    // Count how many have LinkedIn URLs
    const linkedinCount = enrichedAttendees.filter(a => a.linkedin).length;

    // Store the attendees with metadata
    dataStore.setData({
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
    });

    console.log(`Received ${data.attendees.length} attendees from ${data.eventUrl || 'unknown event'}`);
    console.log(`Starting LinkedIn scraping for ${linkedinCount} profiles...`);

    // Start background LinkedIn scraping (don't await)
    // Only start if not already in progress to prevent duplicate API calls
    if (linkedinCount > 0 && !dataStore.isScrapingInProgress) {
      dataStore.isScrapingInProgress = true;
      startLinkedInScraping().catch(error => {
        console.error('Background LinkedIn scraping failed:', error);
        dataStore.isScrapingInProgress = false; // Reset on error
      });
    } else if (dataStore.isScrapingInProgress) {
      console.log('⚠️ LinkedIn scraping already in progress, skipping duplicate job');
    }

    return NextResponse.json({
      success: true,
      message: `Successfully stored ${data.attendees.length} attendees`,
      count: data.attendees.length,
      linkedinScrapingStarted: linkedinCount > 0 && !dataStore.isScrapingInProgress,
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
  const data = dataStore.getData();
  console.log(`🟢 GET /api/attendees - Returning ${data.attendees.length} attendees`);
  if (data.attendees.length === 0) {
    console.warn('⚠️  DataStore is empty! This may indicate an HMR issue or data not yet received.');
  }
  return NextResponse.json(data, { headers: corsHeaders });
}

/**
 * Background function to scrape LinkedIn profiles
 */
async function startLinkedInScraping() {
  const apiKey = process.env.SCRAPINGDOG_API_KEY;
  const data = dataStore.getData();

  if (!apiKey) {
    console.error('SCRAPINGDOG_API_KEY not found in environment variables');
    // Mark all as failed
    data.attendees.forEach(attendee => {
      if (attendee.scrapingStatus === 'pending') {
        attendee.scrapingStatus = 'failed';
        attendee.scrapingError = 'API key not configured';
      }
    });
    data.scrapingProgress.failed = data.scrapingProgress.total;
    data.scrapingProgress.pending = 0;
    dataStore.setData(data);
    return;
  }

  // Extract LinkedIn URLs with their indices
  const linkedinUrls: Array<{ url: string; index: number }> = [];
  data.attendees.forEach((attendee, index) => {
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

      const currentData = dataStore.getData();
      const attendee = currentData.attendees[urlItem.index];

      if (lastResult.success && lastResult.data) {
        // Successfully scraped - update with LinkedIn data
        attendee.linkedinData = lastResult.data;
        attendee.scrapingStatus = 'completed';
        currentData.scrapingProgress.completed++;
      } else {
        // Failed - mark as failed with error
        attendee.scrapingStatus = 'failed';
        attendee.scrapingError = lastResult.error || 'Unknown error';
        currentData.scrapingProgress.failed++;
      }

      currentData.scrapingProgress.pending--;
      dataStore.setData(currentData);

      console.log(
        `LinkedIn scraping progress: ${completed}/${total} ` +
        `(✓ ${currentData.scrapingProgress.completed} / ✗ ${currentData.scrapingProgress.failed})`
      );
    }
  );

  const finalData = dataStore.getData();
  console.log('LinkedIn scraping completed!');
  console.log(`Results: ${finalData.scrapingProgress.completed} successful, ${finalData.scrapingProgress.failed} failed`);

  // Reset scraping flag now that we're done
  dataStore.isScrapingInProgress = false;

  // Start OpenAI scoring after LinkedIn scraping completes
  console.log('Starting OpenAI scoring...');
  if (!dataStore.isScoringInProgress) {
    dataStore.isScoringInProgress = true;
    startOpenAIScoring().catch(error => {
      console.error('Background OpenAI scoring failed:', error);
      dataStore.isScoringInProgress = false; // Reset on error
    });
  }
}

/**
 * Background function to score candidates with OpenAI in parallel
 * Runs after LinkedIn scraping completes
 */
async function startOpenAIScoring() {
  const apiKey = process.env.OPENAI_API_KEY;
  const MAX_CONCURRENT = 10; // Adjust based on OpenAI tier
  const data = dataStore.getData();

  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment variables');
    // Mark all as skipped
    data.attendees.forEach(attendee => {
      if (attendee.scoringStatus === 'pending') {
        attendee.scoringStatus = 'skipped';
        attendee.scoringError = 'OpenAI API key not configured';
      }
    });
    data.scoringProgress.skipped = data.scoringProgress.total;
    data.scoringProgress.pending = 0;
    dataStore.setData(data);
    return;
  }

  // Find attendees with successfully scraped LinkedIn data
  const attendeesToScore: Array<{ attendee: EnrichedAttendee; index: number; id: string }> = [];

  data.attendees.forEach((attendee, index) => {
    if (attendee.scrapingStatus === 'completed' && attendee.linkedinData && attendee.scoringStatus === 'pending') {
      attendeesToScore.push({
        attendee,
        index,
        id: `${index}-${attendee.name}`
      });
    } else if (attendee.scrapingStatus !== 'completed' && attendee.scoringStatus === 'pending') {
      // Skip scoring for attendees without LinkedIn data
      attendee.scoringStatus = 'skipped';
      data.scoringProgress.skipped++;
      data.scoringProgress.pending--;
    }
  });
  dataStore.setData(data);

  if (attendeesToScore.length === 0) {
    console.log('No attendees to score (no successfully scraped LinkedIn profiles)');
    return;
  }

  console.log(`🚀 Scoring ${attendeesToScore.length} candidates with OpenAI (${MAX_CONCURRENT} concurrent)...`);

  // Prepare profiles for parallel scoring
  const profiles = attendeesToScore.map(({ attendee, id }) => ({
    id,
    data: attendee.linkedinData!
  }));

  // Score all candidates in parallel
  const results = await scoreMultipleCandidatesParallel(
    profiles,
    MAX_CONCURRENT,
    (id, result) => {
      // Find the attendee for this ID
      const item = attendeesToScore.find(a => a.id === id);
      if (!item) return;

      const { attendee } = item;
      const currentData = dataStore.getData();

      if (result.success && result.evaluation) {
        // Successfully scored - update with all scoring fields
        const evaluation = result.evaluation;
        attendee.hackathons_won = evaluation.hackathons_won;
        attendee.overall_score = evaluation.overall_score;
        attendee.technical_skill_summary = evaluation.technical_skill_summary || '';
        attendee.collaboration_summary = evaluation.collaboration_summary || '';
        attendee.summary = evaluation.summary || '';
        attendee.scoringStatus = 'completed';

        currentData.scoringProgress.completed++;
        currentData.scoringProgress.pending--;
        console.log(`✓ Scored ${attendee.name}: ${evaluation.overall_score}/100`);
        console.log(`  Tech: ${evaluation.technical_skill_summary?.substring(0, 50)}...`);
        console.log(`  Collab: ${evaluation.collaboration_summary?.substring(0, 50)}...`);
        console.log(`  Summary: ${evaluation.summary?.substring(0, 50)}...`);
      } else {
        // Failed to score
        attendee.scoringStatus = 'failed';
        attendee.scoringError = result.error || 'Unknown scoring error';
        currentData.scoringProgress.failed++;
        currentData.scoringProgress.pending--;
        console.log(`✗ Failed to score ${attendee.name}: ${result.error}`);
      }

      dataStore.setData(currentData);
    }
  );

  const finalData = dataStore.getData();
  console.log('✅ OpenAI scoring completed!');
  console.log(
    `Results: ${finalData.scoringProgress.completed} scored, ` +
    `${finalData.scoringProgress.failed} failed, ` +
    `${finalData.scoringProgress.skipped} skipped`
  );

  // Reset scoring flag now that we're done
  dataStore.isScoringInProgress = false;
}

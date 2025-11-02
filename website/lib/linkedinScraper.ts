import axios from 'axios';
import { readFromCache, writeToCache, ensureCacheDirectory } from './linkedinCache';

// LinkedIn data structure matching sample_output.json
export interface LinkedInProfile {
  profile_photo?: string;
  headline?: string;
  about?: string;
  experience?: Array<{
    position: string;
    company_name: string;
    location: string;
    starts_at: string;
    ends_at: string;
    duration: string;
    summary?: string;
  }>;
  education?: Array<{
    college_name: string;
    college_degree: string;
    college_degree_field: string | null;
    college_duration: string;
  }>;
  articles?: Array<any>;
  description?: {
    description1?: string;
    description1_link?: string;
    description2?: string;
    description2_link?: string;
    description3?: string;
    description3_link?: string;
  };
  activities?: Array<{
    link: string;
    title: string;
    activity: string;
    image?: string;
  }>;
  certification?: Array<{
    certification: string;
    company_name: string;
    issue_date: string;
    credential_id?: string;
  }>;
}

export interface ScrapedResult {
  url: string;
  success: boolean;
  data?: LinkedInProfile;
  error?: string;
}

/**
 * Scrapes a single LinkedIn profile using ScrapingDog API
 */
export async function scrapeLinkedInProfile(
  url: string,
  apiKey: string
): Promise<ScrapedResult> {
  if (!url || !url.includes('linkedin.com')) {
    return {
      url,
      success: false,
      error: 'Invalid LinkedIn URL',
    };
  }

  // Always check cache first for this specific profile
  console.log(`🔍 Checking cache for: ${url}`);
  const cached = readFromCache(url);

  if (cached) {
    // Cache hit - return cached data
    console.log(`✅ Using cached data for: ${url}`);
    return {
      url,
      success: true,
      data: cached.profile,
    };
  }

  // Cache miss - scrape from API and cache the result
  try {
    console.log(`🌐 Cache miss - scraping from API: ${url}`);
    const response = await axios.get('https://api.scrapingdog.com/profile', {
      params: {
        api_key: apiKey,
        type: 'profile',
        id: url,
        premium: 'false',
      },
      timeout: 30000, // 30 second timeout
    });

    // Extract only the fields we need
    const rawData = Array.isArray(response.data) ? response.data[0] : response.data;
    const extractedData = extractRelevantFields(rawData);

    // Write successful scrape to cache
    writeToCache(url, extractedData);

    return {
      url,
      success: true,
      data: extractedData,
    };
  } catch (error: any) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return {
      url,
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
    };
  }
}

/**
 * Extracts only the relevant fields from ScrapingDog API response
 */
function extractRelevantFields(rawData: any): LinkedInProfile {
  return {
    profile_photo: rawData.profile_photo || undefined,
    headline: rawData.headline || undefined,
    about: rawData.about || undefined,
    experience: rawData.experience || [],
    education: rawData.education || [],
    articles: rawData.articles || [],
    description: rawData.description || undefined,
    activities: rawData.activities || [],
    certification: rawData.certification || [],
  };
}

/**
 * Scrapes multiple LinkedIn profiles with rate limiting and progress tracking
 */
export async function scrapeMultipleProfiles(
  urls: string[],
  apiKey: string,
  onProgress?: (completed: number, total: number, lastResult: ScrapedResult) => void
): Promise<ScrapedResult[]> {
  const results: ScrapedResult[] = [];
  const validUrls = urls.filter(url => url && url.includes('linkedin.com'));

  console.log(`Starting LinkedIn scraping for ${validUrls.length} profiles...`);

  for (let i = 0; i < validUrls.length; i++) {
    const url = validUrls[i];

    // Scrape the profile
    const result = await scrapeLinkedInProfile(url, apiKey);
    results.push(result);

    // Call progress callback
    if (onProgress) {
      onProgress(i + 1, validUrls.length, result);
    }

    console.log(
      `LinkedIn scraping progress: ${i + 1}/${validUrls.length} - ${url} - ${result.success ? '✓' : '✗'}`
    );

    // Rate limiting: Wait 1 second between requests to avoid API limits
    if (i < validUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(
    `LinkedIn scraping completed: ${successCount}/${validUrls.length} successful`
  );

  return results;
}

/**
 * Retry a failed scrape with exponential backoff
 */
export async function retryFailedScrape(
  url: string,
  apiKey: string,
  maxRetries: number = 3
): Promise<ScrapedResult> {
  let lastError = '';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Retry attempt ${attempt}/${maxRetries} for ${url}`);

    const result = await scrapeLinkedInProfile(url, apiKey);

    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';

    // Exponential backoff: 2s, 4s, 8s
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    url,
    success: false,
    error: `Failed after ${maxRetries} retries: ${lastError}`,
  };
}

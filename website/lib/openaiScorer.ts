import OpenAI from 'openai';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('⚠️ OPENAI_API_KEY not found in environment variables');
}

const client = apiKey ? new OpenAI({ apiKey }) : null;

// TypeScript interface matching Python's HackathonEvaluation Pydantic model
export interface HackathonEvaluation {
  hackathons_won: number | string; // number or "unavailable"
  overall_score: number; // 1-100
  technical_skill_summary: string;
  collaboration_summary: string;
  summary: string;
}

// LinkedIn profile structure (imported from linkedinScraper.ts)
interface LinkedInProfile {
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
    description2?: string;
    description3?: string;
  };
  activities?: Array<{
    link: string;
    title: string;
    activity: string;
  }>;
  certification?: Array<{
    certification: string;
    company_name: string;
    issue_date: string;
  }>;
}

export interface ScoringResult {
  success: boolean;
  evaluation?: HackathonEvaluation;
  error?: string;
}

/**
 * Formats a LinkedIn profile object into a text string for the OpenAI prompt
 */
export function formatLinkedInProfile(data: LinkedInProfile): string {
  let text = '';

  // Add headline
  if (data.headline) {
    text += `Headline: ${data.headline}\n\n`;
  }

  // Add about section
  if (data.about) {
    text += `About:\n${data.about}\n\n`;
  }

  // Add experience
  if (data.experience && data.experience.length > 0) {
    text += `Experience:\n`;
    data.experience.forEach((exp) => {
      text += `- ${exp.position} at ${exp.company_name}\n`;
      text += `  Location: ${exp.location}\n`;
      text += `  Duration: ${exp.duration} (${exp.starts_at} - ${exp.ends_at})\n`;
      if (exp.summary) {
        text += `  Summary: ${exp.summary}\n`;
      }
      text += '\n';
    });
  }

  // Add education
  if (data.education && data.education.length > 0) {
    text += `Education:\n`;
    data.education.forEach((edu) => {
      text += `- ${edu.college_name}\n`;
      if (edu.college_degree) {
        text += `  Degree: ${edu.college_degree}`;
        if (edu.college_degree_field) {
          text += ` in ${edu.college_degree_field}`;
        }
        text += '\n';
      }
      text += `  Duration: ${edu.college_duration}\n\n`;
    });
  }

  // Add certifications
  if (data.certification && data.certification.length > 0) {
    text += `Certifications:\n`;
    data.certification.forEach((cert) => {
      text += `- ${cert.certification} from ${cert.company_name} (${cert.issue_date})\n`;
    });
    text += '\n';
  }

  // Add activities (only "Shared by" posts, not "Liked by")
  if (data.activities && data.activities.length > 0) {
    const sharedActivities = data.activities.filter(activity =>
      activity.activity && activity.activity.startsWith('Shared by')
    );

    if (sharedActivities.length > 0) {
      text += `Recent LinkedIn Activity (Shared Posts):\n`;
      sharedActivities.slice(0, 5).forEach((activity) => {
        text += `- ${activity.activity}: ${activity.title.substring(0, 100)}${activity.title.length > 100 ? '...' : ''}\n`;
      });
      text += '\n';
    }
  }

  // Add additional descriptions
  if (data.description) {
    const descriptions = [
      data.description.description1,
      data.description.description2,
      data.description.description3
    ].filter(Boolean);

    if (descriptions.length > 0) {
      text += `Additional Information:\n`;
      descriptions.forEach((desc) => {
        text += `${desc}\n\n`;
      });
    }
  }

  return text.trim();
}

/**
 * Scores a candidate using OpenAI API based on their LinkedIn profile
 */
export async function scoreCandidate(profileData: LinkedInProfile): Promise<ScoringResult> {
  if (!client) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    };
  }

  try {
    const profileText = formatLinkedInProfile(profileData);

    if (!profileText || profileText.length < 50) {
      return {
        success: false,
        error: 'Insufficient profile data to score'
      };
    }

    const prompt = `Analyze this LinkedIn profile to evaluate hackathon partnership potential.

Profile:
"""${profileText}"""

Extract and score:

1. Hackathons won: count if mentioned, otherwise use "unavailable"

2. Overall Score (1-100 scale with percentile calibration):
   - Holistic hackathon readiness combining technical skill + collaboration + execution track record
   - Consider: Technical projects, languages, frameworks, system design, teamwork, leadership, communication
   - CALIBRATION: Population of university students where median = 50, top 10% = 80+, exceptional = 90+
   - Distribute scores across 40-70 range for most candidates
   - Only truly exceptional profiles score 85+. Avoid clustering around 70-80

3. Summaries:
   - technical_skill_summary: Paragraph about technical abilities and projects
   - collaboration_summary: Paragraph about teamwork and collaboration abilities
   - summary: Overall paragraph summarizing interests and background`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using faster model - change to 'gpt-4o' for better quality
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower temperature for more consistent scoring
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'HackathonEvaluation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              hackathons_won: {
                type: ['number', 'string'],
                description: "Number of hackathons won, or 'unavailable' if not mentioned"
              },
              overall_score: {
                type: 'number',
                minimum: 1,
                maximum: 100,
                description: 'Overall hackathon readiness score 1-100'
              },
              technical_skill_summary: {
                type: 'string',
                description: 'Paragraph summary of technical skills'
              },
              collaboration_summary: {
                type: 'string',
                description: 'Paragraph summary of collaboration ability'
              },
              summary: {
                type: 'string',
                description: 'Overall paragraph summary'
              }
            },
            required: [
              'hackathons_won',
              'overall_score',
              'technical_skill_summary',
              'collaboration_summary',
              'summary'
            ],
            additionalProperties: false
          }
        }
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'No response from OpenAI'
      };
    }

    const evaluation: HackathonEvaluation = JSON.parse(content);

    return {
      success: true,
      evaluation
    };
  } catch (error) {
    console.error('Error scoring candidate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Scores multiple candidates in parallel with controlled concurrency
 * Uses semaphore-like pattern with Promise.all for efficient batching
 */
export async function scoreMultipleCandidatesParallel(
  profiles: Array<{ id: string; data: LinkedInProfile }>,
  maxConcurrent: number = 10,
  onProgress?: (id: string, result: ScoringResult) => void
): Promise<Map<string, ScoringResult>> {
  const results = new Map<string, ScoringResult>();

  // Process in batches of maxConcurrent
  for (let i = 0; i < profiles.length; i += maxConcurrent) {
    const batch = profiles.slice(i, i + maxConcurrent);

    // Process all profiles in this batch concurrently
    await Promise.all(
      batch.map(async (profile) => {
        const result = await scoreCandidate(profile.data);
        results.set(profile.id, result);

        if (onProgress) {
          onProgress(profile.id, result);
        }
      })
    );
  }

  return results;
}

/**
 * Scores multiple candidates sequentially (legacy, for compatibility)
 */
export async function scoreMultipleCandidates(
  profiles: Array<{ id: string; data: LinkedInProfile }>,
  onProgress?: (id: string, result: ScoringResult) => void
): Promise<Map<string, ScoringResult>> {
  const results = new Map<string, ScoringResult>();

  for (const profile of profiles) {
    const result = await scoreCandidate(profile.data);
    results.set(profile.id, result);

    if (onProgress) {
      onProgress(profile.id, result);
    }

    // Rate limiting: 1 second delay between API calls
    if (profiles.indexOf(profile) < profiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

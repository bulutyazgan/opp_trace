import OpenAI from 'openai';

// Initialize OpenAI client
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('⚠️ OPENAI_API_KEY not found in environment variables');
}

const client = apiKey ? new OpenAI({ apiKey }) : null;

// LinkedIn profile structure (matching openaiScorer.ts)
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

export interface CandidateProfile {
  id: string;
  name?: string;
  data: LinkedInProfile;
}

export interface EmailDraft {
  subject: string;
  body: string;
}

export interface EmailGenerationResult {
  success: boolean;
  emailDraft?: EmailDraft;
  error?: string;
}

/**
 * Formats a candidate's LinkedIn profile into a concise summary for the prompt
 */
function formatCandidateSummary(candidate: CandidateProfile): string {
  const profile = candidate.data;
  let summary = `Candidate: ${candidate.name || candidate.id}\n`;

  if (profile.headline) {
    summary += `  Headline: ${profile.headline}\n`;
  }

  if (profile.experience && profile.experience.length > 0) {
    const latestExp = profile.experience[0];
    summary += `  Current/Recent: ${latestExp.position} at ${latestExp.company_name}\n`;
  }

  if (profile.education && profile.education.length > 0) {
    const latestEdu = profile.education[0];
    summary += `  Education: ${latestEdu.college_degree || 'Student'} at ${latestEdu.college_name}\n`;
  }

  // Extract key skills or technical mentions from about section
  if (profile.about) {
    const shortAbout = profile.about.substring(0, 200);
    summary += `  About: ${shortAbout}${profile.about.length > 200 ? '...' : ''}\n`;
  }

  return summary;
}

/**
 * Generates a team invitation email for multiple candidates for a hackathon
 * @param candidates Array of 3-5 candidate profiles
 * @param hackathonDescription Description of the hackathon
 * @returns Email draft with subject and body
 */
export async function generateTeamInvitationEmail(
  candidates: CandidateProfile[],
  hackathonDescription: string
): Promise<EmailGenerationResult> {
  if (!client) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    };
  }

  if (candidates.length < 3 || candidates.length > 5) {
    return {
      success: false,
      error: 'Must provide between 3 and 5 candidates'
    };
  }

  if (!hackathonDescription || hackathonDescription.trim().length < 10) {
    return {
      success: false,
      error: 'Hackathon description is required and must be meaningful'
    };
  }

  try {
    // Format candidate information
    const candidateSummaries = candidates
      .map(candidate => formatCandidateSummary(candidate))
      .join('\n');

    const prompt = `You are helping to draft a professional and engaging email to invite a team of talented individuals to join your hackathon team.

Hackathon Details:
"""${hackathonDescription}"""

Potential Team Members:
${candidateSummaries}

Generate a warm, professional email invitation that:
1. Introduces yourself briefly (assume you're a fellow student/developer)
2. Describes the hackathon and why it's exciting
3. Explains why you think this specific group would make a great team (reference their complementary skills/backgrounds)
4. Invites them to join your team
5. Suggests next steps (e.g., meeting to discuss ideas)
6. Maintains a friendly but professional tone

The email should feel personal and thoughtful, not generic. It should be addressed to the group collectively.

Return ONLY the email subject and body in the specified JSON format.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5, // 0.5
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'EmailDraft',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              subject: {
                type: 'string',
                description: 'Email subject line (concise and engaging)'
              },
              body: {
                type: 'string',
                description: 'Full email body with greeting, content, and closing'
              }
            },
            required: ['subject', 'body'],
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

    const emailDraft: EmailDraft = JSON.parse(content);

    return {
      success: true,
      emailDraft
    };
  } catch (error) {
    console.error('Error generating team invitation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Generates personalized individual invitation emails for each candidate
 * Alternative approach that creates separate emails instead of one group email
 */
export async function generateIndividualInvitationEmails(
  candidates: CandidateProfile[],
  hackathonDescription: string,
  teamContext?: string
): Promise<Map<string, EmailGenerationResult>> {
  const results = new Map<string, EmailGenerationResult>();

  for (const candidate of candidates) {
    try {
      const otherCandidates = candidates.filter(c => c.id !== candidate.id);
      const teamInfo = otherCandidates.length > 0
        ? `\n\nOther potential team members:\n${otherCandidates.map(c => `- ${c.name || c.id}: ${c.data.headline || 'No headline'}`).join('\n')}`
        : '';

      const prompt = `Generate a personalized email invitation for a hackathon team.

Hackathon Details:
"""${hackathonDescription}"""

Candidate to invite:
${formatCandidateSummary(candidate)}
${teamContext ? `\nTeam context: ${teamContext}` : ''}${teamInfo}

Create a warm, professional email that:
1. Addresses them personally
2. References their specific skills/background
3. Explains why they'd be a great fit for the team
4. Describes the hackathon opportunity
5. Invites them to join and suggests next steps

Return the email subject and body in JSON format.`;

      if (!client) {
        results.set(candidate.id, {
          success: false,
          error: 'OpenAI API key not configured'
        });
        continue;
      }

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'EmailDraft',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                subject: {
                  type: 'string',
                  description: 'Email subject line'
                },
                body: {
                  type: 'string',
                  description: 'Full email body'
                }
              },
              required: ['subject', 'body'],
              additionalProperties: false
            }
          }
        }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const emailDraft: EmailDraft = JSON.parse(content);
        results.set(candidate.id, {
          success: true,
          emailDraft
        });
      } else {
        results.set(candidate.id, {
          success: false,
          error: 'No response from OpenAI'
        });
      }

      // Rate limiting between individual emails
      if (candidates.indexOf(candidate) < candidates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      results.set(candidate.id, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

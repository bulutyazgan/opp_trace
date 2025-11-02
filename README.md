# Opp Trace

**Hackathon Attendee Analysis & Ranking System**

Opp Trace helps hackathon organizers and participants identify the most experienced attendees at events listed on Luma. The system automatically scrapes attendee data, analyzes their profiles, and ranks them based on experience and past performance.

## What It Does

### Current Functionality

**1. Automated Attendee Data Collection (Chrome Extension)**
- Adds a "Conduct Analysis" button to any Luma event page
- Scrapes the complete guest list when clicked
- For each attendee, extracts:
  - Name and Luma profile URL
  - Social media links (LinkedIn, Instagram, X/Twitter, TikTok, personal website)
  - Number of events attended on Luma
- Processes attendees in batches of 10 with rate limiting to avoid detection
- Automatically sends data to the local dashboard API

**2. Real-Time Dashboard (Next.js Web App)**
- Receives and displays attendee data in a clean table interface
- Shows all social media links as clickable buttons
- Auto-refreshes every 5 seconds to show new data as it arrives
- Provides CSV export functionality for further analysis
- Accessible at `localhost:3000` during development

**3. AI-Powered Candidate Scoring (Python Script)**
- Uses OpenAI's GPT API to analyze LinkedIn profiles
- Scores candidates 1-100 on three metrics:
  - **Technical Skill Score**: Based on education, projects, and technical experience
  - **Collaboration Score**: Teamwork, leadership, and communication abilities
  - **Overall Hackathon Readiness**: Combined assessment of hackathon suitability
- Extracts structured data:
  - University and degree information
  - Work experience count
  - Number of hackathons won
- Outputs ranked JSON file (`hackathon_rankings.json`) sorted by overall score

## How It Works

```
┌─────────────────┐
│  Luma Event     │
│  Guest List     │
└────────┬────────┘
         │
         │ ① Chrome Extension scrapes attendee data
         ↓
┌─────────────────┐
│ Local Dashboard │  ② Stores & displays data
│  (Next.js API)  │  ③ Shows social links
└────────┬────────┘
         │
         │ ④ Export LinkedIn profiles
         ↓
┌─────────────────┐
│ Python Scoring  │  ⑤ AI analyzes profiles
│   (OpenAI API)  │  ⑥ Generates rankings
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Rankings JSON  │  ⑦ Sorted by scores
└─────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (REST)
- **Scraping**: Vanilla JavaScript (Chrome Extension), Axios
- **AI Analysis**: OpenAI API (GPT-5-nano), Pydantic for structured output
- **Storage**: In-memory (temporary, resets on server restart)

## Quick Start

### 1. Start the Dashboard
```bash
cd website
npm install
npm run dev
```
Dashboard runs at `http://localhost:3000`

### 2. Install Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension/` folder

### 3. Scrape an Event
1. Navigate to any Luma event (e.g., `https://lu.ma/jrec73nt`)
2. Click the "Conduct Analysis" button that appears
3. Wait for scraping to complete (monitor browser console)
4. Dashboard automatically opens with collected data

### 4. Score Candidates (Optional)
```bash
# Edit gpt_ranking.py to add LinkedIn URLs from dashboard
python3 gpt_ranking.py

# Output: hackathon_rankings.json with scores
```

## Current Limitations

- **No Database**: Data is stored in-memory and lost on server restart
- **Manual LinkedIn Export**: Must manually copy LinkedIn URLs to Python script
- **Local Only**: Dashboard runs on localhost, not production-ready
- **Rate Limiting**: Processes ~2 seconds per attendee (batched)
- **API Keys Exposed**: OpenAI and ScrapingDog keys hardcoded in files

## Example Output

**Dashboard View**:
| Name | LinkedIn | Instagram | X | Events Attended |
|------|----------|-----------|---|-----------------|
| John Doe | 🔗 | 🔗 | - | 5 |
| Jane Smith | 🔗 | - | 🔗 | 12 |

**Rankings JSON**:
```json
{
  "name": "John Doe",
  "university": "MIT",
  "degree": "Computer Science",
  "technical_skill_score": 92,
  "collaboration_score": 88,
  "overall_score": 95,
  "hackathons_won": 3,
  "work_experience_count": 2
}
```

## Use Cases

- **Team Formation**: Find experienced teammates before the event
- **Organizer Insights**: Understand attendee experience distribution
- **Networking**: Identify potential collaborators based on skills
- **Mentorship**: Connect experienced hackers with beginners

## Next Steps

See `CLAUDE.md` for planned enhancements:
- Database persistence (PostgreSQL/MongoDB)
- Automated LinkedIn scraping integration
- Direct pipeline: Extension → API → Scoring → Dashboard
- User authentication
- Production deployment (Vercel)

---

**Note**: This tool is for personal use and small-scale analysis. Ensure compliance with Luma and LinkedIn Terms of Service before large-scale scraping.
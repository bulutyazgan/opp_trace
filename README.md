# LumedIn Analytics

**AI-Powered Hackathon Team Intelligence Platform**

LumedIn Analytics (formerly Opp Trace) is a comprehensive platform that helps hackathon participants and organizers discover, analyze, and connect with the best teammates at events listed on Luma. The system automatically scrapes attendee data, enriches it with LinkedIn profiles, uses AI to score candidates, and provides tools for team formation including face recognition and AI-generated team invitations.

## 🚀 What It Does

### Complete Feature Set

#### **1. Automated Attendee Data Collection (Chrome Extension)**
- Adds a floating widget with "Analyze Event" button to any Luma event page
- Scrapes the complete guest list when clicked
- Extracts for each attendee:
  - Name and Luma profile URL
  - Social media links (LinkedIn, Instagram, X/Twitter, TikTok, personal website)
  - Number of events attended on Luma
  - Profile photo
- Processes attendees in batches with intelligent rate limiting
- Automatically sends data to the dashboard API
- Visual feedback during scraping process

#### **2. Automated LinkedIn Profile Enrichment**
- **ScrapingDog API Integration**: Professional LinkedIn scraping service
- **Smart Caching System**: Stores profiles in `/website/temp/linkedin_cache/` to avoid redundant API calls
- **Background Job Processing**: Automatically triggered after attendee data is received
- Extracts comprehensive profile data:
  - Profile photo and headline
  - About section
  - Work experience (position, company, duration, location)
  - Education (university, degree, field, duration)
  - Certifications
  - Activities and shared posts
- **Real-time Progress Tracking**: Dashboard shows scraping progress with live updates
- **Rate Limiting**: 1 second delay between requests to avoid throttling
- **Error Handling**: Automatic retries with exponential backoff

#### **3. AI-Powered Candidate Scoring (OpenAI Integration)**
- **Automatic Processing**: Runs immediately after LinkedIn scraping completes
- **Parallel Execution**: Processes up to 10 profiles concurrently for speed
- Uses OpenAI's GPT-4o-mini for intelligent analysis
- Generates three scored metrics (1-100 scale):
  - **Technical Skill Score**: Based on education, projects, and technical experience
  - **Collaboration Score**: Teamwork, leadership, and communication abilities
  - **Overall Hackathon Readiness**: Combined assessment of hackathon suitability
- Extracts structured insights:
  - Number of hackathons won
  - Technical skill summary
  - Collaboration summary
  - Overall candidate summary
- **Conditional Display**: Summaries only generated for exceptional candidates (score >75 or <20)
- **Real-time Progress Bars**: Shows scoring progress live in dashboard
- Calibrated percentile system for accurate ranking

#### **4. Advanced Dashboard (Next.js Web App)**
- **Comprehensive Table View** with sortable columns:
  - Expandable rows with full profile details
  - Profile photo with fallback icons
  - Name with Luma profile link
  - LinkedIn headline
  - Events attended count
  - LinkedIn profile link (icon)
  - Scraping status badge (⏳ Scraping, ✓ Done, ✗ Failed)
  - Overall score (ranked display)
  - Hackathons won
  - Social media links (IG, X, TT, Web)
  - Selection checkbox for team formation
- **Expandable Profile Details**:
  - AI-generated summaries (Technical Skills, Collaboration, Overall)
  - Full about section
  - Work experience (top 3 + count)
  - Education history
  - Certifications (top 3 + count)
  - Recent shared activity
- **Real-time Progress Tracking**:
  - LinkedIn scraping progress bar
  - OpenAI scoring progress bar
  - Live status updates every 5 seconds
- **Action Buttons**:
  - 📷 Face recognition matching
  - ✉️ AI team invite generator
  - ⬇️ CSV export with all enriched data
- **Dark Theme**: Professional purple-accent design (#8523cc)
- **Auto-refresh**: Updates every 5 seconds to show new data

#### **5. Face Recognition & Matching**
- **Camera Modal**: Capture or upload photos directly in browser
- **Python Backend**: Uses DeepFace library with multiple detection models
- **Advanced Image Processing**:
  - Automatic face detection and extraction
  - Image quality assessment
  - Face enhancement preprocessing
  - Multiple detection backends (OpenCV, SSD, MTCNN, Dlib, RetinaFace)
- **Matching Algorithm**:
  - Ensemble mode with multiple models (VGG-Face, Facenet512, ArcFace, etc.)
  - Confidence scoring (0-1 scale)
  - Threshold-based matching (default: 0.4)
- **Results Display**:
  - Match result modal with profile details
  - Similarity confidence score
  - Auto-scroll to matched row in table
  - Visual highlight animation
- **Use Case**: Quickly find someone you met at the event

#### **6. AI Team Invitation Generator**
- **Smart Selection System**:
  - Checkbox in each attendee row
  - "Select All" option in header
  - Selection counter in summary
- **Adaptive Email Generation**:
  - **1-2 candidates**: Individual personalized invitations
  - **3-5 candidates**: Group team invitation
  - Button automatically adapts based on selection
- **Dual Modal Workflow**:
  - Hackathon description input modal
  - Email preview modal with copy-to-clipboard
- **AI-Powered Content**:
  - Uses OpenAI GPT-4o-mini
  - References candidate backgrounds and skills
  - Personalized messaging
  - Professional tone
- **JSON Schema Validation**: Ensures consistent email structure
- **Use Case**: Invite skilled teammates to join your hackathon project

#### **7. Data Persistence & Storage**
- **Hybrid Storage Architecture**:
  - In-memory data store for fast access
  - File-based LinkedIn profile cache (permanent)
  - Singleton pattern survives Next.js HMR
- **Smart Caching**:
  - LinkedIn profiles cached indefinitely
  - Cache checked before every API call
  - Significant cost savings on repeated scraping
- **Progress Tracking**: Persisted across page refreshes
- **Automatic Restoration**: Server restart loads cached data

## 🔄 How It Works

### Complete End-to-End Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: DATA COLLECTION                │
│                                                                  │
│  Luma Event Page                                                │
│  └─→ Chrome Extension Widget Appears                            │
│      └─→ User Clicks "Analyze Event"                            │
│          └─→ Scrapes All Attendees (name, socials, events)      │
│              └─→ Sends to Dashboard API (POST /api/attendees)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: DATA STORAGE & VALIDATION           │
│                                                                  │
│  Next.js API Route (/api/attendees)                             │
│  ├─→ Validates attendee data                                    │
│  ├─→ Stores in DataStore singleton (in-memory)                  │
│  └─→ Returns success response to extension                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 3: AUTOMATED LINKEDIN ENRICHMENT             │
│                    (Background Job - Automatic)                 │
│                                                                  │
│  For Each Attendee with LinkedIn:                               │
│  ├─→ Check cache (/temp/linkedin_cache/{hash}.json)             │
│  │   ├─→ IF FOUND: Load from cache (instant, free)              │
│  │   └─→ IF NOT FOUND:                                          │
│  │       ├─→ Call ScrapingDog API                               │
│  │       ├─→ Wait 1 second (rate limiting)                      │
│  │       ├─→ Save to cache for future use                       │
│  │       └─→ Update progress (⏳ → ✓ Done / ✗ Failed)           │
│  └─→ Real-time progress visible in dashboard                    │
│                                                                  │
│  Status Updates:                                                │
│  • pending → scraping... → completed                            │
│  • Progress bar: "✓ X completed, ⏳ Y pending, ✗ Z failed"      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               PHASE 4: AI SCORING & ANALYSIS                    │
│              (Background Job - Automatic)                       │
│                                                                  │
│  Triggered After LinkedIn Scraping Completes:                   │
│  ├─→ Filters candidates with LinkedIn data                      │
│  ├─→ Parallel processing (10 concurrent requests)               │
│  ├─→ For Each Candidate:                                        │
│  │   ├─→ Send profile to OpenAI GPT-4o-mini                     │
│  │   ├─→ Generate scores (technical, collaboration, overall)    │
│  │   ├─→ Extract hackathons won                                 │
│  │   ├─→ Generate summaries (if score >75 or <20)              │
│  │   └─→ Update attendee record                                 │
│  └─→ Real-time progress visible in dashboard                    │
│                                                                  │
│  Status Updates:                                                │
│  • pending → scoring... → completed                             │
│  • Progress bar: "✓ X scored, ⏳ Y pending, ✗ Z failed"         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 5: DASHBOARD DISPLAY                   │
│                                                                  │
│  Dashboard Auto-refreshes Every 5 Seconds:                      │
│  ├─→ Fetches latest data (GET /api/attendees)                   │
│  ├─→ Shows scraping progress bar (if still running)             │
│  ├─→ Shows scoring progress bar (if still running)              │
│  ├─→ Displays table sorted by overall_score DESC                │
│  └─→ Each row shows:                                            │
│      ├─→ Profile photo + name + headline                        │
│      ├─→ Status badges, scores, hackathons won                  │
│      ├─→ Expandable details (click ▶ to expand)                 │
│      │   └─→ AI summaries + full profile info                   │
│      └─→ Selection checkbox                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 6: INTERACTIVE FEATURES                   │
│                                                                  │
│  User Actions Available:                                        │
│                                                                  │
│  1. 📷 FACE RECOGNITION                                         │
│     ├─→ Click camera button                                     │
│     ├─→ Capture/upload photo in modal                           │
│     ├─→ POST to /api/match-face                                 │
│     ├─→ Python DeepFace service processes                       │
│     ├─→ Returns matched profile with confidence                 │
│     └─→ Auto-scrolls to matched row + highlights                │
│                                                                  │
│  2. ✉️ TEAM INVITE GENERATOR                                    │
│     ├─→ Select 1+ candidates with checkboxes                    │
│     ├─→ Click mail button (enabled when 1+ selected)            │
│     ├─→ Modal opens: enter hackathon description                │
│     ├─→ POST to /api/generate-invite                            │
│     │   ├─→ 1-2 selected: Individual mode                       │
│     │   └─→ 3-5 selected: Team mode                             │
│     ├─→ OpenAI GPT-4o-mini generates email                      │
│     ├─→ Preview modal shows subject + body                      │
│     └─→ Copy to clipboard button                                │
│                                                                  │
│  3. ⬇️ CSV EXPORT                                               │
│     ├─→ Click download button                                   │
│     ├─→ Generates CSV with ALL enriched data                    │
│     └─→ Downloads: luma_attendees_enriched_YYYY-MM-DD.csv       │
└─────────────────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Purpose | Triggers |
|----------|--------|---------|----------|
| `/api/attendees` | POST | Receive attendee data from extension | LinkedIn scraping → OpenAI scoring |
| `/api/attendees` | GET | Fetch current data with progress | Dashboard auto-refresh |
| `/api/match-face` | POST | Face recognition matching | Python DeepFace service |
| `/api/generate-invite` | POST | AI email generation | OpenAI GPT-4o-mini |

### Data Flow

```
Extension → API → DataStore → Background Jobs
                     ↓              ↓
                  Dashboard ← [Scraping] → Cache
                     ↓              ↓
                   User    ← [Scoring] → OpenAI
                     ↓
            [Face Match / Email Gen]
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **React 18**: UI components with hooks
- **TypeScript**: Type-safe development
- **CSS Modules**: Scoped styling with dark theme
- **lucide-react**: Icon library (Camera, Download, Linkedin, Mail)

### Backend
- **Next.js API Routes**: RESTful endpoints
- **Node.js**: Runtime environment
- **Python 3.10+**: Face recognition service
  - **DeepFace**: Face recognition library
  - **OpenCV**: Computer vision
  - **Pillow**: Image processing
  - **Flask**: Lightweight web server

### AI & Scraping
- **OpenAI API**: GPT-4o-mini for scoring and email generation
- **ScrapingDog API**: Professional LinkedIn scraping service
- **Face Recognition**: Multiple models (VGG-Face, Facenet512, ArcFace)

### Storage & Caching
- **In-Memory Store**: Singleton pattern with DataStore class
- **File-Based Cache**: JSON files in `/website/temp/linkedin_cache/`
- **Session Persistence**: Survives Next.js HMR and server restarts

### Chrome Extension
- **Vanilla JavaScript**: No framework dependencies
- **Chrome Extension API**: Manifest V3
- **Content Scripts**: Inject UI into Luma pages
- **Background Workers**: Handle API communication

## ⚙️ Setup & Installation

### Prerequisites
```bash
# Required
- Node.js 18+ and npm
- Python 3.10+
- Chrome browser
- API Keys:
  - OpenAI API key (for scoring + email generation)
  - ScrapingDog API key (for LinkedIn scraping)
```

### 1. Environment Setup

Create `.env.local` in `website/` directory:
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
SCRAPINGDOG_API_KEY=your_scrapingdog_key_here
```

### 2. Install Dependencies

**Website (Dashboard):**
```bash
cd website
npm install
```

**Python Service (Face Recognition):**
```bash
cd website
pip install -r requirements.txt
```

### 3. Start Services

**Terminal 1 - Dashboard:**
```bash
cd website
npm run dev
```
Dashboard runs at `http://localhost:3000`

**Terminal 2 - Face Recognition Service:**
```bash
cd website
python face_recognition_service.py
```
Service runs at `http://localhost:5000`

### 4. Install Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `extension/` folder from this project
5. The extension icon should appear in your toolbar

### 5. Usage Workflow

**Step 1: Analyze an Event**
1. Navigate to any Luma event page (e.g., `https://lu.ma/jrec73nt`)
2. Wait for the floating "LumedIn Analyzer" widget to appear (top right)
3. Click "Analyze Event" button
4. Extension scrapes attendees and sends to dashboard
5. Dashboard automatically opens at `localhost:3000`

**Step 2: Wait for Enrichment (Automatic)**
- LinkedIn scraping progress bar appears (may take 1-5 minutes depending on attendee count)
- OpenAI scoring progress bar appears after scraping (may take 2-10 minutes)
- Progress bars show: ✓ completed, ⏳ pending, ✗ failed counts
- Dashboard auto-refreshes every 5 seconds

**Step 3: Explore Data**
- Click ▶ on any row to expand full profile details
- View AI-generated summaries for top candidates
- Sort by overall score (automatic, highest first)
- Check scraping/scoring status for each attendee

**Step 4: Use Interactive Features**

**Face Recognition:**
1. Click 📷 camera button in summary section
2. Capture or upload a photo
3. System matches face against all attendees
4. Auto-scrolls to matched person with highlight

**Team Invite Generator:**
1. Check boxes next to 1-5 candidates you want to invite
2. Click ✉️ mail button (shows "Individual" or "Team" in tooltip)
3. Enter hackathon description in modal
4. Click "Generate Email"
5. Preview email in modal
6. Click "Copy to Clipboard"
7. Paste into your email client

**CSV Export:**
1. Click ⬇️ download button
2. CSV file downloads with all enriched data
3. Includes: name, profile URLs, socials, LinkedIn data, scores, summaries

## 📊 Example Output

### Dashboard Table View
| Expand | Photo | Name | Headline | Events | LinkedIn | Status | Score | Hackathons Won | Socials | ☑️ |
|--------|-------|------|----------|--------|----------|--------|-------|----------------|---------|---|
| ▶ | ![](photo) | **John Doe**<br/>[Luma Profile] | Software Engineer at Google | 5 | [🔗] | ✓ Done | **92/100** | 3 | IG X Web | ☐ |
| ▼ | ![](photo) | **Jane Smith**<br/>[Luma Profile] | CS @ MIT \| AI Researcher | 12 | [🔗] | ✓ Done | **88/100** | 2 | X TT | ☑ |

### Expanded Row Details
```
┌─────────────────────────────────────────────────────────────┐
│  AI SUMMARIES (Top of Expanded Section)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────┐ │
│  │ Technical Skills  │  │  Collaboration   │  │ Overall  │ │
│  ├───────────────────┤  ├──────────────────┤  ├──────────┤ │
│  │ Expert in ML/AI   │  │ Strong team      │  │ Excellent│ │
│  │ frameworks with   │  │ leader with      │  │ hackathon│ │
│  │ 3+ years of       │  │ proven track     │  │ candidate│ │
│  │ experience...     │  │ record...        │  │ with...  │ │
│  └───────────────────┘  └──────────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ABOUT                                                       │
│  Passionate software engineer specializing in...            │
│                                                              │
│  EXPERIENCE (3 total)                                        │
│  • Software Engineer at Google                               │
│    2 years • Mountain View, CA                              │
│  • Intern at Meta                                            │
│    6 months • Menlo Park, CA                                │
│  + 1 more                                                    │
│                                                              │
│  EDUCATION                                                   │
│  • MIT - Bachelor of Science (Computer Science)             │
│    2018 - 2022                                              │
└─────────────────────────────────────────────────────────────┘
```

### Face Recognition Result
```
┌─────────────────────────────────────────┐
│  ✓ Match Found!                         │
├─────────────────────────────────────────┤
│  Name: John Doe                         │
│  Confidence: 87.3%                      │
│  LinkedIn: Software Engineer at Google  │
│                                         │
│  [View Profile in Table]                │
└─────────────────────────────────────────┘
```

### Generated Email Example
```
Subject: Invitation to Join Our AI Hackathon Team

Hi John, Jane, and Sarah,

I came across your profiles at the upcoming AI Innovation Hackathon
and was impressed by your combined expertise in machine learning,
full-stack development, and product design.

John - Your work on distributed ML systems at Google would be
invaluable for the scalability challenges we'll face...

[AI-generated personalized content continues...]

Looking forward to building something amazing together!

Best regards,
[Your Name]
```

## 🎯 Use Cases

### For Participants
- **Team Formation**: Find the most experienced teammates before the event
- **Skill Discovery**: Identify candidates with specific technical skills
- **Quick Networking**: Use face recognition to reconnect with someone you met
- **Professional Outreach**: Generate personalized team invitations

### For Organizers
- **Attendee Insights**: Understand the experience distribution of your audience
- **Mentorship Matching**: Connect experienced hackers with beginners
- **Sponsor Analytics**: Show skill demographics to sponsors
- **Event Planning**: Tailor workshops based on attendee profiles

### For Recruiters
- **Talent Discovery**: Find skilled developers at hackathons
- **Candidate Screening**: Export data for recruitment pipelines
- **Portfolio Analysis**: Review project history and achievements

## 📝 Current Limitations

### Technical Constraints
- **LinkedIn Rate Limits**: ScrapingDog API has usage limits (check your plan)
- **OpenAI Costs**: Scoring and email generation use API credits
- **Local Deployment**: Dashboard runs on localhost (not production-ready by default)
- **Cache Storage**: LinkedIn cache grows over time (manual cleanup needed)
- **Face Recognition**: Requires clear, well-lit photos for best accuracy

### Data Constraints
- **Luma Platform Only**: Extension only works on lu.ma and luma.com domains
- **Public Profiles**: Can only access publicly visible LinkedIn data
- **Manual Selection**: Team invite generator requires manual checkbox selection
- **No Batch Export**: Emails generated one at a time

### Scalability Notes
- In-memory storage suitable for events with <500 attendees
- Parallel scoring (10 concurrent) balances speed vs API limits
- Single-server deployment (no horizontal scaling)

## 🚀 Production Deployment

### Recommended Hosting
- **Dashboard**: Vercel, Netlify, or Railway
- **Face Recognition**: Render, Railway, or dedicated VPS
- **Database** (if needed): PostgreSQL on Railway or Supabase

### Environment Variables for Production
```bash
# Required
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
SCRAPINGDOG_API_KEY=your_scrapingdog_key_here

# Optional (if deploying face recognition separately)
FACE_RECOGNITION_API_URL=https://your-face-service.com
```

### Production Checklist
- [ ] Set up environment variables on hosting platform
- [ ] Configure CORS for API routes
- [ ] Set up file storage for LinkedIn cache (S3, R2, etc.)
- [ ] Deploy face recognition service separately
- [ ] Update extension manifest with production API URL
- [ ] Test entire workflow on production environment

## 🔒 Privacy & Compliance

### Data Handling
- All data is scraped from **publicly visible profiles**
- No authentication credentials are stored
- LinkedIn profiles are cached locally (not shared)
- Face recognition data is processed in-memory (not stored)
- CSV exports contain only public information

### Terms of Service
- **Luma**: Review Luma's Terms of Service before scraping events
- **LinkedIn**: ScrapingDog handles compliance with LinkedIn's ToS
- **OpenAI**: Follow OpenAI's usage policies for API access
- **Personal Use**: This tool is designed for personal/small-scale analysis

### Recommendations
- Do not scrape events with >1000 attendees without permission
- Respect rate limits and use caching to minimize API calls
- Do not share or sell attendee data
- Use generated emails responsibly (no spam)

## 🤝 Contributing

This is a hackathon project and may have rough edges. Contributions welcome:
- Bug fixes and improvements
- New features (e.g., database integration, batch email export)
- Documentation updates
- UI/UX enhancements

## 📄 License

This project is provided as-is for educational and personal use. Ensure compliance with all third-party Terms of Service before deployment.

## 🙏 Acknowledgments

- **ScrapingDog**: Professional LinkedIn scraping API
- **OpenAI**: GPT-4o-mini for intelligent scoring and content generation
- **DeepFace**: Open-source face recognition library
- **Next.js Team**: Excellent framework and documentation
- **Luma**: Event platform that makes attendee data accessible

---

**Built with ❤️ for the hackathon community**

*Last Updated: November 2025*

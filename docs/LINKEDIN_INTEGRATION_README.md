# LinkedIn Integration - Setup & Usage Guide

This guide explains how to use the newly integrated LinkedIn scraping feature in the Opp Trace dashboard.

## What's New

The dashboard now automatically enriches attendee data with LinkedIn profiles when you analyze a Luma event. Here's what happens:

1. **Chrome Extension** scrapes Luma event attendees
2. **Data is sent** to the dashboard API
3. **LinkedIn scraping starts automatically** in the background
4. **Dashboard displays partial results** as LinkedIn data arrives in real-time
5. **Expandable rows** show detailed LinkedIn information

## Setup Instructions

### 1. Get Your ScrapingDog API Key

1. Go to [ScrapingDog.com](https://www.scrapingdog.com/)
2. Sign up for an account
3. Get your API key from the dashboard

### 2. Configure Environment Variables

Edit the file: `website/.env.local`

```bash
SCRAPINGDOG_API_KEY=your_actual_api_key_here
```

Replace `your_api_key_here` with your actual ScrapingDog API key.

### 3. Install Dependencies (Already Done)

```bash
cd website
npm install
```

### 4. Start the Dashboard

```bash
cd website
npm run dev
```

The dashboard will be available at **http://localhost:3000**

## How It Works

### Data Flow

```
Chrome Extension (Luma scraping)
    ↓
POST /api/attendees
    ↓
Store in memory + Start LinkedIn scraping
    ↓
Background process scrapes LinkedIn profiles (1 per second)
    ↓
Updates in-memory storage as each profile completes
    ↓
Dashboard polls every 5 seconds
    ↓
Displays partial results with progress bar
```

### What Data is Scraped from LinkedIn

For each attendee with a LinkedIn profile, the system scrapes:

- **profile_photo** - Profile picture URL
- **headline** - LinkedIn headline (e.g., "CS Student @ UCL | Hackathon Winner")
- **about** - About section text
- **experience** - Work history with positions, companies, dates
- **education** - Schools, degrees, fields of study
- **articles** - Published articles
- **description** - Additional profile descriptions
- **activities** - Recent LinkedIn activity (posts, likes, comments)
- **certification** - Certifications earned

### Dashboard Features

#### Progress Bar
Shows real-time scraping progress:
- ✓ **Completed** (green) - Successfully scraped profiles
- ⏳ **Pending** (orange) - Profiles being scraped
- ✗ **Failed** (red) - Profiles that failed to scrape

#### Expandable Rows
Click the ▶ button to expand any row and see:
- Full about section
- Top 3 work experiences (with "show more" for additional)
- All education history
- Recent certifications
- LinkedIn activity (posts, engagements)

#### Status Indicators
Each row shows scraping status:
- **⏳ Scraping...** - Currently being scraped
- **✓ Done** - Successfully scraped
- **✗ Failed** - Scraping failed (with error message)
- **-** - No LinkedIn profile provided

## Usage

### Step-by-Step

1. **Start the dashboard**:
   ```bash
   cd website
   npm run dev
   ```

2. **Load Chrome extension** (at chrome://extensions/)

3. **Navigate to a Luma event** (e.g., https://lu.ma/your-event)

4. **Click "Conduct Analysis"** button in top-right

5. **Wait for initial scraping** (Luma profiles - ~2-10 minutes depending on attendees)

6. **Dashboard opens automatically** showing initial data

7. **LinkedIn scraping starts** in background (visible in progress bar)

8. **Watch data populate** in real-time as LinkedIn profiles are scraped

9. **Expand rows** to see detailed LinkedIn information

10. **Download CSV** with all data (Luma + LinkedIn)

### Expected Timeline

For an event with **50 attendees**:
- **Luma scraping**: ~5-7 minutes (done by extension)
- **LinkedIn scraping**: ~50-60 seconds (1 per second, background)
- **Total time**: Data visible immediately, fully enriched in ~6-8 minutes

### Rate Limiting

LinkedIn scraping is rate-limited to **1 profile per second** to avoid API restrictions and bans. This means:
- 10 profiles = ~10 seconds
- 50 profiles = ~50 seconds
- 100 profiles = ~100 seconds

## Troubleshooting

### "API key not configured" error

**Problem**: SCRAPINGDOG_API_KEY not found in environment

**Solution**:
1. Check that `website/.env.local` exists
2. Verify the API key is set correctly
3. Restart the Next.js dev server (`npm run dev`)

### LinkedIn scraping shows all "Failed"

**Problem**: ScrapingDog API issues (invalid key, rate limit exceeded, API down)

**Solution**:
1. Verify API key is correct
2. Check ScrapingDog dashboard for remaining credits
3. Check API status at https://www.scrapingdog.com/
4. Look at terminal logs for specific error messages

### Dashboard doesn't update

**Problem**: Auto-refresh not working

**Solution**:
1. Manually refresh the page (F5)
2. Check browser console for errors (F12)
3. Verify `npm run dev` is still running

### Data disappears after server restart

**Expected behavior**: Data is stored in-memory and clears on restart

**Future solution**: Will be migrated to database (SQLite/PostgreSQL)

### Some profiles show "Loading..." forever

**Problem**: Profile scraping stuck or failed silently

**Solution**:
1. Check terminal logs for errors
2. Wait for auto-refresh (every 5 seconds)
3. If stuck >60 seconds, restart server and re-scrape

## API Costs

ScrapingDog API pricing:
- **Free tier**: Limited requests
- **Paid plans**: Starting at $20/month for 5,000 requests
- **Cost per profile**: ~1 request = $0.004 (on $20 plan)

**Example**: Scraping 100 profiles = ~100 requests = ~$0.40

## Data Privacy & Legal

### Important Considerations

1. **LinkedIn ToS**: LinkedIn prohibits automated scraping. ScrapingDog handles the technical scraping, but verify ToS compliance for your use case.

2. **Data Storage**: Currently stores data in-memory (temporary). Future database storage requires GDPR/CCPA compliance considerations.

3. **Personal Data**: LinkedIn profiles contain personal information. Ensure proper consent and legal compliance for your region.

4. **Rate Limiting**: Respect ScrapingDog's rate limits to avoid service disruption.

## Files Modified

This integration involved creating/modifying these files:

### Created:
- `website/lib/linkedinScraper.ts` - LinkedIn scraping module
- `website/.env.local` - Environment variables (API key)
- `LINKEDIN_INTEGRATION_README.md` - This file

### Modified:
- `website/app/api/attendees/route.ts` - API with background scraping
- `website/app/page.tsx` - Dashboard with LinkedIn data display
- `website/app/page.module.css` - Styles for new UI elements
- `website/package.json` - Added axios dependency

## Next Steps

After verifying the integration works:

1. **Database Integration**: Replace in-memory storage with SQLite/PostgreSQL
2. **AI Scoring**: Integrate `gpt_ranking.py` to score candidates based on LinkedIn data
3. **Caching**: Don't re-scrape same profiles within X days
4. **Retry Logic**: Automatically retry failed scrapes
5. **Production Deploy**: Deploy to Vercel or similar platform

## Testing Checklist

- [ ] Dashboard starts without errors (`npm run dev`)
- [ ] Extension sends data to dashboard
- [ ] Initial attendee data displays immediately
- [ ] Progress bar appears and shows scraping status
- [ ] LinkedIn data populates as scraping progresses
- [ ] Expandable rows show detailed LinkedIn information
- [ ] Status indicators update correctly (pending → completed/failed)
- [ ] CSV download includes LinkedIn data
- [ ] Error messages display for failed scrapes
- [ ] Auto-refresh updates dashboard every 5 seconds

## Support

For issues or questions:
1. Check terminal logs for error messages
2. Review browser console (F12) for client-side errors
3. Verify API key and ScrapingDog account status
4. Check CLAUDE.md for project architecture details

---

**Ready to test!** Start the dashboard and analyze a Luma event to see LinkedIn data populate in real-time.

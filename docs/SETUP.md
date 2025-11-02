# Setup Guide: Luma Attendee Analyzer with Dashboard

This guide will help you set up the complete system where the Chrome extension sends attendee data to your local dashboard website.

## Architecture Overview

```
Luma Event Page → Chrome Extension → API (localhost:3000) → Dashboard UI
```

The extension scrapes attendee data from Luma and sends it to your Next.js dashboard via a REST API.

## Prerequisites

- Node.js (v18 or higher)
- Google Chrome browser
- npm or yarn package manager

## Setup Instructions

### 1. Set Up the Dashboard Website

```bash
# Navigate to the website directory
cd website

# Install dependencies
npm install

# Start the development server
npm run dev
```

The dashboard will be available at **http://localhost:3000**

You should see a message: "No attendee data yet"

### 2. Install the Chrome Extension

1. Generate the extension icons:
   - Open `extension/create-icons.html` in your browser
   - Click "Generate Icons" button
   - Move the downloaded PNG files into the `extension` folder

2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extension` folder
   - Verify the extension is enabled

3. **Important:** Reload the extension after loading it to ensure the manifest changes take effect

### 3. Test the Complete Flow

1. Keep the dashboard running at http://localhost:3000
2. Navigate to any Luma event page (e.g., https://luma.com/jrec73nt)
3. Wait for the "Conduct Analysis" button to appear (top-right corner)
4. Click the button
5. Watch the browser console for progress (F12 → Console)
6. After analysis completes:
   - Data is sent to the API
   - Dashboard opens automatically in a new tab
   - Attendee data is displayed in a table

## How It Works

### Extension → API Flow

1. **Extension scrapes data:**
   ```javascript
   // Collects attendees with social links
   const results = [
     { name: "John Doe", profileUrl: "...", instagram: "...", ... },
     // ... more attendees
   ]
   ```

2. **Extension sends POST request:**
   ```javascript
   fetch('http://localhost:3000/api/attendees', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       attendees: results,
       eventUrl: window.location.href
     })
   })
   ```

3. **API stores data:**
   - Receives data at `/api/attendees` endpoint
   - Stores in memory (temporary, resets on server restart)
   - Returns success response

4. **Dashboard displays data:**
   - Auto-refreshes every 5 seconds
   - Fetches data from GET `/api/attendees`
   - Displays in responsive table
   - Includes CSV download option

## File Structure

```
opp_trace/
├── extension/
│   ├── manifest.json        # Chrome extension config (updated with localhost permission)
│   ├── content.js           # Main script (sends data to API)
│   ├── styles.css           # Button styling
│   ├── create-icons.html    # Icon generator
│   └── icon*.png            # Extension icons (generated)
│
└── website/
    ├── package.json         # Next.js dependencies
    ├── next.config.js       # Next.js configuration
    ├── tsconfig.json        # TypeScript configuration
    └── app/
        ├── layout.tsx       # Root layout
        ├── page.tsx         # Dashboard UI (client component)
        ├── page.module.css  # Dashboard styles
        ├── globals.css      # Global styles
        └── api/
            └── attendees/
                └── route.ts # API endpoint (POST/GET)
```

## Key Changes from Original Extension

### Before (CSV Download)
- Extension scraped data and created CSV file
- Downloaded CSV to user's computer
- Data stayed local

### After (Dashboard Integration)
- Extension scrapes data and sends to API
- Dashboard stores and displays data
- Data can be processed/analyzed on the server
- Opens dashboard automatically in new tab

## API Endpoints

### POST `/api/attendees`
Receives attendee data from the extension.

**Request body:**
```json
{
  "attendees": [
    {
      "name": "John Doe",
      "profileUrl": "https://luma.com/user/...",
      "instagram": "https://instagram.com/...",
      "x": "https://x.com/...",
      "tiktok": "",
      "linkedin": "https://linkedin.com/in/...",
      "website": "https://example.com"
    }
  ],
  "eventUrl": "https://luma.com/jrec73nt"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully stored 42 attendees",
  "count": 42
}
```

### GET `/api/attendees`
Returns stored attendee data for the dashboard.

**Response:**
```json
{
  "attendees": [...],
  "eventUrl": "https://luma.com/jrec73nt",
  "timestamp": "2025-11-01T12:34:56.789Z",
  "count": 42
}
```

## Troubleshooting

### Extension can't connect to API
- Make sure the dashboard is running at http://localhost:3000
- Check that the extension manifest includes `"http://localhost:3000/*"` in host_permissions
- Reload the extension at chrome://extensions/
- Check browser console for CORS or network errors

### Dashboard shows "No attendee data yet"
- Verify the API endpoint is working: visit http://localhost:3000/api/attendees
- Check the extension successfully sent data (browser console)
- Try manually refreshing the dashboard page

### Extension button not appearing
- Make sure you're on a Luma event page (not homepage or /calendar)
- Check browser console for errors
- Verify the extension is enabled at chrome://extensions/

### Data disappears after refresh
- The current implementation uses in-memory storage
- Data is lost when the Next.js dev server restarts
- This is intentional for now - database integration comes later

## Next Steps

This setup provides the foundation for:
- Adding database persistence (PostgreSQL, MongoDB, etc.)
- Implementing data processing/analysis logic
- Adding authentication and user accounts
- Deploying to production (Vercel, AWS, etc.)
- Creating additional visualizations and insights

For now, you have a working local development environment where the extension sends data to your dashboard!

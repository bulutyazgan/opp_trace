# Luma Attendee Dashboard

Next.js dashboard for receiving and displaying attendee data from the Luma Attendee Analyzer Chrome extension.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:3000 to see the dashboard.

## Features

- **API Endpoint**: Receives attendee data from the Chrome extension via POST `/api/attendees`
- **Dashboard UI**: Displays attendee data in a responsive table
- **Auto-refresh**: Updates every 5 seconds to show new data
- **CSV Export**: Download attendee data as CSV file
- **Event Tracking**: Shows which Luma event the data came from

## Project Structure

```
website/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Dashboard (client component)
│   ├── page.module.css         # Dashboard styles
│   ├── globals.css             # Global styles
│   └── api/
│       └── attendees/
│           └── route.ts        # API endpoint
├── package.json
├── tsconfig.json
└── next.config.js
```

## API Reference

### POST `/api/attendees`
Receives attendee data from the extension.

**Request:**
```json
{
  "attendees": [
    {
      "name": "string",
      "profileUrl": "string",
      "instagram": "string",
      "x": "string",
      "tiktok": "string",
      "linkedin": "string",
      "website": "string"
    }
  ],
  "eventUrl": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully stored N attendees",
  "count": N
}
```

### GET `/api/attendees`
Returns stored attendee data.

**Response:**
```json
{
  "attendees": [...],
  "eventUrl": "string",
  "timestamp": "ISO 8601 timestamp",
  "count": N
}
```

## Development Notes

- **Data Storage**: Currently uses in-memory storage (resets on server restart)
- **Port**: Runs on port 3000 by default
- **Auto-refresh**: Dashboard polls API every 5 seconds
- **CORS**: No CORS configuration needed since extension uses host_permissions

## Future Enhancements

- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] Data persistence across server restarts
- [ ] User authentication
- [ ] Advanced analytics and visualizations
- [ ] Export to multiple formats
- [ ] Filtering and search functionality
- [ ] Historical event tracking

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **CSS Modules** - Scoped component styling
- **Fetch API** - Client-side data fetching

## Deployment

When ready for production:

1. Update API endpoint URL in extension (change from localhost to production URL)
2. Deploy to Vercel, AWS, or other hosting platform
3. Add database for persistent storage
4. Implement authentication if needed
5. Update extension manifest with production URL

See the main SETUP.md for complete deployment instructions.

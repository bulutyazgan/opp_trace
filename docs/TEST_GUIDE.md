# Testing Guide

## ✅ CORS Issue Fixed!

The API now includes proper CORS headers to allow requests from `luma.com`.

## How to Test

### 1. **Refresh the Luma Page**
   - The page at https://luma.com/jrec73nt?tk=TszFJD is still open
   - **Press F5 or Ctrl+R** to refresh the page
   - This will reload the content script with the updated permissions

### 2. **Click "Conduct Analysis" Again**
   - Wait for the button to appear (top-right corner)
   - Click it
   - Open Console (F12) to watch progress

### 3. **What Should Happen**

   **In the Console:**
   ```
   Luma Analyzer: Content script loaded
   Starting Luma attendee analysis...
   Clicking guests button...
   Found guests list, collecting attendees...
   Found 347 unique attendees
   Processing batch 1/35 (10 attendees)...
   ✓ Bulut Yazgan
   ✓ Aaditya Nair
   ... (more attendees)
   ✓ Processed all 347 attendees!
   Sending data to dashboard...
   ✓ Data sent successfully: {success: true, ...}
   ✓ Dashboard opened in new tab!
   ```

   **Result:**
   - Dashboard opens automatically in a new tab
   - Shows all 347 attendees with their social links
   - Event URL displayed at the top

### 4. **Verify in Dashboard**
   - Visit http://localhost:3000 (should open automatically)
   - Should show table with:
     - Names
     - Profile URLs
     - Social media links (Instagram, X, TikTok, LinkedIn, Website)
   - Total count: 347 attendees

## What Was Fixed

### Problem
The extension couldn't send data to the API due to CORS (Cross-Origin Resource Sharing) restrictions. Browsers block requests from one domain (luma.com) to another (localhost:3000) unless the server explicitly allows it.

### Solution
Added CORS headers to the API endpoint:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

Now the API accepts requests from any origin (including luma.com).

## Troubleshooting

### If it still doesn't work:

1. **Check browser console for errors**
   - Press F12 on the Luma page
   - Look at the Console tab
   - Share any error messages

2. **Verify the server is running**
   - Check terminal shows "Ready in Xms"
   - Visit http://localhost:3000 in browser
   - Should see the dashboard

3. **Hard refresh the extension**
   - Go to chrome://extensions/
   - Click reload icon on "Luma Attendee Analyzer"
   - Refresh the Luma page (F5)

4. **Check network tab**
   - F12 → Network tab
   - Click "Conduct Analysis"
   - Look for request to "localhost:3000/api/attendees"
   - Check if it shows "Status 200" or any errors

## Expected Timeline

With 347 attendees:
- Processing time: ~7-10 minutes (fetching social links from each profile)
- Batch size: 10 attendees at a time
- Total batches: 35 batches
- Progress shown in console

The button will show "Analyzing..." during this time, then "Analysis Complete!" when done.

---

**Ready to test!** Refresh the Luma page and click "Conduct Analysis" again.

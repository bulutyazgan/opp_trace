// Content script for Luma Attendee Analyzer Chrome Extension
// This script injects an "Analyze Attendees" button on Luma event pages

(function() {
  'use strict';

  console.log('Luma Analyzer: Content script loaded');

  // Only run on event pages - Luma events have short URLs like /jrec73nt
  // Skip homepage, calendar pages, and other non-event pages
  const path = window.location.pathname;
  if (path === '/' || path.startsWith('/calendar') || path.startsWith('/discover') || path.startsWith('/create')) {
    console.log('Luma Analyzer: Not an event page, skipping');
    return;
  }

  // Wait for page to load and check if it's an event page
  function waitForGuestsButton() {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const guestsButton = document.querySelector('.guests-button') ||
                           document.querySelector('[class*="guest"]') ||
                           document.querySelector('button[class*="Guest"]');

        if (guestsButton || document.readyState === 'complete') {
          clearInterval(checkInterval);
          resolve(!!guestsButton);
        }
      }, 500);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(false);
      }, 10000);
    });
  }

  waitForGuestsButton().then(isEventPage => {
    if (isEventPage) {
      console.log('Luma Analyzer: Event page detected, initializing...');
      initializeAnalyzer();
    } else {
      console.log('Luma Analyzer: No guests button found, not an event page');
    }
  });

  function initializeAnalyzer() {
    // Check if button already exists
    if (document.getElementById('luma-analyzer-widget')) {
      console.log('Luma Analyzer: Widget already exists');
      return;
    }

    // Create the widget container
    const widget = document.createElement('div');
    widget.id = 'luma-analyzer-widget';
    widget.className = 'luma-analyzer-widget';

    // Create toggle button (collapsed state)
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'luma-analyzer-toggle';
    toggleBtn.innerHTML = '📊';
    toggleBtn.title = 'LumedIn Analyzer';

    // Create expanded panel
    const panel = document.createElement('div');
    panel.className = 'luma-analyzer-panel hidden';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'luma-analyzer-header';
    panelHeader.innerHTML = '<span>LumedIn</span>';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'luma-analyzer-close';
    closeBtn.innerHTML = '✕';
    closeBtn.title = 'Minimize';

    panelHeader.appendChild(closeBtn);

    // Create analyze button
    const analyzeButton = document.createElement('button');
    analyzeButton.className = 'luma-analyzer-btn';
    analyzeButton.textContent = 'Analyze Event';
    analyzeButton.title = 'Analyze attendees and send to dashboard';

    panel.appendChild(panelHeader);
    panel.appendChild(analyzeButton);

    widget.appendChild(toggleBtn);
    widget.appendChild(panel);
    document.body.appendChild(widget);

    // Toggle panel visibility
    toggleBtn.addEventListener('click', () => {
      panel.classList.remove('hidden');
      toggleBtn.classList.add('hidden');
    });

    closeBtn.addEventListener('click', () => {
      panel.classList.add('hidden');
      toggleBtn.classList.remove('hidden');
    });

    // Add click handler for analyze button
    analyzeButton.addEventListener('click', async () => {
      analyzeButton.disabled = true;
      analyzeButton.textContent = 'Analyzing...';

      try {
        await analyzeAttendees();
        analyzeButton.textContent = '✓ Complete!';
        setTimeout(() => {
          analyzeButton.textContent = 'Analyze Event';
          analyzeButton.disabled = false;
        }, 3000);
      } catch (error) {
        console.error('Analysis failed:', error);
        alert('Analysis failed: ' + error.message);
        analyzeButton.textContent = '✗ Failed';
        setTimeout(() => {
          analyzeButton.textContent = 'Analyze Event';
          analyzeButton.disabled = false;
        }, 3000);
      }
    });

    console.log('Luma Analyzer: Widget injected successfully');
  }

  // Main analysis function (converted from your original script)
  async function analyzeAttendees() {
    console.log('Starting Luma attendee analysis...');

    // 1. Click the guests button to open the guests list
    const guestsButton = document.querySelector('.guests-button') ||
                        document.querySelector('[class*="guest"]') ||
                        document.querySelector('button[class*="Guest"]');

    if (!guestsButton) {
      throw new Error('Guests button not found! Make sure you are on a Luma event page.');
    }

    console.log('Clicking guests button...');
    guestsButton.click();

    // Wait for the guests list to appear
    await new Promise(r => setTimeout(r, 1500));

    // 2. Find the guests list container and collect attendee links
    // Try multiple selectors for the guests list
    let guestsList = document.querySelector('.outer.overflow-auto') ||
                     document.querySelector('[class*="guest"][class*="list"]') ||
                     document.querySelector('[class*="attendee"]') ||
                     document.querySelector('[role="dialog"] [class*="overflow"]');

    if (!guestsList) {
      throw new Error('Guests list not found! The popup may not have opened. Try clicking the guests button manually first.');
    }

    console.log('Found guests list, collecting attendees...');

    // Look for user profile links
    const attendeeLinks = Array.from(guestsList.querySelectorAll('a[href*="/user/"]')) ||
                         Array.from(guestsList.querySelectorAll('a[href^="/"]')).filter(a => a.href.includes('/user/'));

    const seen = new Set();
    const attendees = [];
    for (const link of attendeeLinks) {
      const url = link.href.startsWith('http') ? link.href : (location.origin + link.getAttribute('href'));
      if (seen.has(url)) continue;
      seen.add(url);

      const name = link.textContent.trim();
      if (name && url.includes('/user/')) {
        attendees.push({
          name: name,
          profileUrl: url
        });
      }
    }

    if (attendees.length === 0) {
      throw new Error('No attendees found! The page structure may have changed.');
    }

    console.log(`Found ${attendees.length} unique attendees`);

    // Helper to fetch and parse social links and events attended from a profile page
    async function getSocialLinks(profileUrl) {
      try {
        const res = await fetch(profileUrl, { credentials: 'include' });
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const socialLinks = Array.from(doc.querySelectorAll('.social-links a'));
        const result = {
          instagram: '',
          x: '',
          tiktok: '',
          linkedin: '',
          website: '',
          eventsAttended: 0
        };
        for (const a of socialLinks) {
          const href = a.href;
          if (/instagram\.com/i.test(href)) result.instagram = href;
          else if (/twitter\.com|x\.com/i.test(href)) result.x = href;
          else if (/tiktok\.com/i.test(href)) result.tiktok = href;
          else if (/linkedin\.com/i.test(href)) result.linkedin = href;
          else if (!/lumacdn\.com|lu\.ma|luma\.com/i.test(href)) result.website = href;
        }

        // Extract events attended count
        // Look for pattern: <span class="fw-medium">6</span> followed by <span>Attended</span>
        const eventsText = Array.from(doc.querySelectorAll('span.fw-medium')).find(span => {
          // Check next sibling element
          const nextElement = span.nextElementSibling;
          if (nextElement && nextElement.textContent.includes('Attended')) {
            return true;
          }
          // Also check if parent contains "Attended" text nearby
          const parentText = span.parentElement?.textContent || '';
          return parentText.includes('Attended');
        });
        if (eventsText) {
          result.eventsAttended = parseInt(eventsText.textContent.trim()) || 0;
        }

        return result;
      } catch (e) {
        console.error(`Failed to fetch ${profileUrl}:`, e);
        return {
          instagram: '',
          x: '',
          tiktok: '',
          linkedin: '',
          website: '',
          eventsAttended: 0
        };
      }
    }

    // 3. Process attendees in parallel batches for speed
    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
      const batch = attendees.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(attendees.length / BATCH_SIZE)} (${batch.length} attendees)...`);

      const batchResults = await Promise.all(
        batch.map(async (attendee) => {
          const socials = await getSocialLinks(attendee.profileUrl);
          console.log(`✓ ${attendee.name}`);
          return {
            name: attendee.name,
            profileUrl: attendee.profileUrl,
            ...socials
          };
        })
      );

      results.push(...batchResults);

      // Small delay between batches
      if (i + BATCH_SIZE < attendees.length) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // 4. Build CSV rows
    const rows = [
      ['Name', 'Profile URL', 'Events Attended', 'Instagram', 'X', 'TikTok', 'LinkedIn', 'Website']
    ];
    for (const result of results) {
      rows.push([
        result.name,
        result.profileUrl,
        result.eventsAttended,
        result.instagram,
        result.x,
        result.tiktok,
        result.linkedin,
        result.website
      ]);
    }

    console.log(`✓ Processed all ${attendees.length} attendees!`);

    // 5. Send data to dashboard API
    const API_URL = 'http://localhost:3000/api/attendees';

    try {
      console.log('Sending data to dashboard...');
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendees: results,
          eventUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✓ Data sent successfully:', result);

      // Wait for server to fully process and stabilize before opening dashboard
      // Increased delay to allow Next.js modules to stabilize after data storage
      console.log('⏳ Waiting 2 seconds for server to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Open dashboard in new tab
      window.open('http://localhost:3000', '_blank');
      console.log('✓ Dashboard opened in new tab!');

    } catch (error) {
      console.error('Failed to send data to dashboard:', error);
      throw new Error(`Failed to send data to dashboard: ${error.message}`);
    }
  }
})();

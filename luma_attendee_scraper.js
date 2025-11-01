(async function() {
  // 1. Click the guests button to open the guests list
  const guestsButton = document.querySelector('.guests-button');
  if (!guestsButton) {
    console.error('Guests button not found! Make sure you are on a Luma event page.');
    return;
  }
  guestsButton.click();

  // Wait for the guests list to appear
  await new Promise(r => setTimeout(r, 1000));

  // 2. Find the guests list container and collect attendee links
  const guestsList = document.querySelector('.outer.overflow-auto');
  if (!guestsList) {
    console.error('Guests list not found! The popup may not have opened.');
    return;
  }

  const attendeeLinks = Array.from(guestsList.querySelectorAll('a[href^="/user/"]'));
  const seen = new Set();
  const attendees = [];
  for (const link of attendeeLinks) {
    const url = link.href.startsWith('http') ? link.href : (location.origin + link.getAttribute('href'));
    if (seen.has(url)) continue;
    seen.add(url);
    attendees.push({
      name: link.textContent.trim(),
      profileUrl: url
    });
  }

  console.log(`Found ${attendees.length} unique attendees`);

  // 2. Helper to fetch and parse social links and events attended from a profile page
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
        else if (!/lumacdn\.com|lu\.ma/i.test(href)) result.website = href; // fallback for personal website
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
  const BATCH_SIZE = 10; // Process 10 attendees at a time
  const results = [];

  for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
    const batch = attendees.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(attendees.length / BATCH_SIZE)} (${batch.length} attendees)...`);

    // Process all attendees in this batch in parallel
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

    // Small delay between batches to be polite to the server
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

  // 5. Download as CSV
  const csv = rows.map(r => r.map(x => `"${(x||'').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'luma_attendees_with_socials.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
})(); 

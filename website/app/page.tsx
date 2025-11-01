'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface Attendee {
  name: string;
  profileUrl: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;
}

interface AttendeeData {
  attendees: Attendee[];
  eventUrl?: string;
  timestamp?: string;
  count?: number;
}

export default function Dashboard() {
  const [data, setData] = useState<AttendeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/attendees');
      if (!response.ok) {
        throw new Error('Failed to fetch attendee data');
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds to catch new data
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const downloadCSV = () => {
    if (!data || !data.attendees || data.attendees.length === 0) return;

    const rows = [
      ['Name', 'Profile URL', 'Instagram', 'X', 'TikTok', 'LinkedIn', 'Website']
    ];

    for (const attendee of data.attendees) {
      rows.push([
        attendee.name,
        attendee.profileUrl,
        attendee.instagram || '',
        attendee.x || '',
        attendee.tiktok || '',
        attendee.linkedin || '',
        attendee.website || ''
      ]);
    }

    const csv = rows.map(r => r.map(x => `"${(x||'').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luma_attendees_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading attendee data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    );
  }

  const attendees = data?.attendees || [];
  const hasData = attendees.length > 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Luma Attendee Dashboard</h1>
        {data?.eventUrl && (
          <p className={styles.eventUrl}>
            Event: <a href={data.eventUrl} target="_blank" rel="noopener noreferrer">{data.eventUrl}</a>
          </p>
        )}
        {data?.timestamp && (
          <p className={styles.timestamp}>Last updated: {new Date(data.timestamp).toLocaleString()}</p>
        )}
      </header>

      {!hasData ? (
        <div className={styles.noData}>
          <h2>No attendee data yet</h2>
          <p>Use the Chrome extension on a Luma event page to analyze attendees.</p>
          <p>The data will appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <h2>Summary</h2>
            <p>Total Attendees: <strong>{attendees.length}</strong></p>
            <button onClick={downloadCSV} className={styles.downloadBtn}>
              Download CSV
            </button>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Profile</th>
                  <th>Instagram</th>
                  <th>X</th>
                  <th>TikTok</th>
                  <th>LinkedIn</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee, index) => (
                  <tr key={index}>
                    <td>{attendee.name}</td>
                    <td>
                      <a href={attendee.profileUrl} target="_blank" rel="noopener noreferrer">
                        View Profile
                      </a>
                    </td>
                    <td>
                      {attendee.instagram ? (
                        <a href={attendee.instagram} target="_blank" rel="noopener noreferrer">
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {attendee.x ? (
                        <a href={attendee.x} target="_blank" rel="noopener noreferrer">
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {attendee.tiktok ? (
                        <a href={attendee.tiktok} target="_blank" rel="noopener noreferrer">
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {attendee.linkedin ? (
                        <a href={attendee.linkedin} target="_blank" rel="noopener noreferrer">
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {attendee.website ? (
                        <a href={attendee.website} target="_blank" rel="noopener noreferrer">
                          Link
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

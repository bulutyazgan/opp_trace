'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { Camera, Download, Linkedin, Twitter, Instagram, Globe, Eye } from 'lucide-react';
import Image from 'next/image';
import styles from './page.module.css';
import './themes.css';
import CameraModal from '@/components/CameraModal';
import MatchResult from '@/components/MatchResult';
import CircularProgress from '@/components/CircularProgress';
import ThemeToggler from '@/components/ThemeToggler';
import AttendeeDetailsModal from '@/components/AttendeeDetailsModal';

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
  }>;
  education?: Array<{
    college_name: string;
    college_degree: string;
    college_degree_field: string | null;
    college_duration: string;
  }>;
}

interface Attendee {
  name: string;
  profileUrl: string;
  eventsAttended?: number;
  instagram?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  website?: string;

  // LinkedIn enrichment
  linkedinData?: LinkedInProfile | null;
  scrapingStatus?: 'pending' | 'completed' | 'failed' | 'no_linkedin';
  scrapingError?: string;

  // OpenAI scoring data
  hackathons_won?: number | string | null;
  overall_score?: number | null;
  technical_skill_summary?: string | null;
  collaboration_summary?: string | null;
  summary?: string | null;
  scoringStatus?: 'pending' | 'completed' | 'failed' | 'skipped';
  scoringError?: string;
}

interface AttendeeData {
  attendees: Attendee[];
  eventUrl?: string;
  timestamp?: string;
  count?: number;
  scrapingProgress?: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
  };
  scoringProgress?: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    skipped: number;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<AttendeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Attendee details modal state
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Face recognition state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showMatchResult, setShowMatchResult] = useState(false);
  const [matchData, setMatchData] = useState<any>(null);
  const [matchedRowIndex, setMatchedRowIndex] = useState<number | null>(null);
  const [faceMatchLoading, setFaceMatchLoading] = useState(false);
  const [faceMatchError, setFaceMatchError] = useState<string | null>(null);
  const matchedRowRef = useRef<HTMLTableRowElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = async (preserveScrollPosition = false) => {
    try {
      if (!preserveScrollPosition) {
        setLoading(true);
      }
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
      if (!preserveScrollPosition) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 seconds to catch LinkedIn scraping progress
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  // GSAP animation for table rows on mount
  useEffect(() => {
    if (data && data.attendees.length > 0 && tableRef.current) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      gsap.fromTo(
        rows,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.03,
          ease: 'power2.out',
        }
      );
    }
  }, [data]);

  // GSAP animation for container on mount
  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.children,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.15,
          ease: 'power3.out',
        }
      );
    }
  }, [loading]);

  const openDetailsModal = (attendee: Attendee) => {
    setSelectedAttendee(attendee);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedAttendee(null);
  };

  const handleCameraCapture = async (imageData: string) => {
    setShowCameraModal(false);
    setFaceMatchLoading(true);
    setFaceMatchError(null);

    try {
      const response = await fetch('/api/match-face', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Face matching failed');
      }

      if (result.match) {
        // Find the index of the matched profile in the current attendees list
        const matchedProfile = result.match.profile;
        const attendees = (data?.attendees || []).sort((a, b) => {
          const scoreA = a.overall_score ?? -1;
          const scoreB = b.overall_score ?? -1;
          return scoreB - scoreA;
        });

        const matchedIndex = attendees.findIndex(
          (a) => a.name === matchedProfile.name && a.profileUrl === matchedProfile.profileUrl
        );

        if (matchedIndex !== -1) {
          setMatchedRowIndex(matchedIndex);

          // Scroll to matched row after a brief delay
          setTimeout(() => {
            if (matchedRowRef.current) {
              matchedRowRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }
          }, 100);
        }

        setMatchData(result.match);
        setShowMatchResult(true);
      } else {
        setFaceMatchError('No matching face found');
      }
    } catch (err) {
      console.error('Face matching error:', err);
      setFaceMatchError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFaceMatchLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!data || !data.attendees || data.attendees.length === 0) return;

    const rows = [
      [
        'Name', 'Profile URL', 'Events Attended', 'Instagram', 'X', 'TikTok', 'LinkedIn', 'Website',
        'Headline', 'Scraping Status',
        'Overall Score', 'Hackathons Won',
        'Technical Skill Summary', 'Collaboration Summary', 'Summary', 'Scoring Status'
      ]
    ];

    for (const attendee of data.attendees) {
      rows.push([
        attendee.name,
        attendee.profileUrl,
        String(attendee.eventsAttended || 0),
        attendee.instagram || '',
        attendee.x || '',
        attendee.tiktok || '',
        attendee.linkedin || '',
        attendee.website || '',
        attendee.linkedinData?.headline || '',
        attendee.scrapingStatus || '',
        attendee.overall_score?.toString() || '',
        attendee.hackathons_won?.toString() || '',
        attendee.technical_skill_summary || '',
        attendee.collaboration_summary || '',
        attendee.summary || '',
        attendee.scoringStatus || ''
      ]);
    }

    const csv = rows.map(r => r.map(x => `"${(x||'').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `luma_attendees_enriched_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <motion.div
          className={styles.loading}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={styles.spinner}></div>
          Loading attendee data...
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <motion.div
          className={styles.error}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Error: {error}
        </motion.div>
      </div>
    );
  }

  // Sort attendees by overall_score descending (highest first)
  const attendees = (data?.attendees || []).sort((a, b) => {
    const scoreA = a.overall_score ?? -1;
    const scoreB = b.overall_score ?? -1;
    return scoreB - scoreA;
  });

  const hasData = attendees.length > 0;
  const progress = data?.scrapingProgress;
  const scoringProgress = data?.scoringProgress;

  // Check if scraping is in progress
  const isScrapingInProgress = progress && progress.pending > 0 && progress.completed === 0;

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Theme Toggler */}
      <ThemeToggler />

      {/* Horizontal Header with Progress */}
      <div className={styles.headerWithProgress}>
        {/* Left: Title Section */}
        <div className={styles.titleSection}>
          <div className={styles.titleWithLogo}>
            <Image
              src="/media/logo.png"
              alt="LumedIn Logo"
              width={48}
              height={48}
              className={styles.logo}
            />
            <h1 className={styles.mainTitle}>LumedIn Analytics</h1>
          </div>
          {data?.eventUrl && (
            <p className={styles.eventUrl}>
              Event: <a href={data.eventUrl} target="_blank" rel="noopener noreferrer">{data.eventUrl}</a>
            </p>
          )}
          {data?.timestamp && (
            <p className={styles.timestamp}>Last updated: {new Date(data.timestamp).toLocaleString()}</p>
          )}
        </div>

        {/* Right: Progress Circles */}
        <div className={styles.progressCircles}>
          {/* LinkedIn Enrichment Progress */}
          {progress && progress.total > 0 && (
            <div className={styles.progressWrapper}>
              <h3 className={styles.progressTitle}>LinkedIn Enrichment</h3>
              <div className={styles.progressGroup}>
                <CircularProgress
                  value={progress.completed}
                  max={progress.total}
                  size={140}
                  strokeWidth={10}
                  color="#8b5cf6"
                />
                <div className={styles.progressStats}>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>✓</span> {progress.completed} completed
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>⏳</span> {progress.pending} pending
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>✗</span> {progress.failed} failed
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* AI Scoring Progress */}
          {scoringProgress && scoringProgress.total > 0 && (
            <div className={styles.progressWrapper}>
              <h3 className={styles.progressTitle}>AI Scoring</h3>
              <div className={styles.progressGroup}>
                <CircularProgress
                  value={scoringProgress.completed}
                  max={scoringProgress.total}
                  size={140}
                  strokeWidth={10}
                  color="#a78bfa"
                />
                <div className={styles.progressStats}>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>✓</span> {scoringProgress.completed} scored
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>⏳</span> {scoringProgress.pending} pending
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>✗</span> {scoringProgress.failed} failed
                  </span>
                  <span className={styles.statItem}>
                    <span className={styles.statIcon}>⊘</span> {scoringProgress.skipped} skipped
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!hasData ? (
        <motion.div
          className={styles.noData}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2>No attendee data yet</h2>
          <p>Use the Chrome extension on a Luma event page to analyze attendees.</p>
          <p>The data will appear here automatically.</p>
        </motion.div>
      ) : (
        <>
          <div className={styles.summary}>
            <div>
              <h2>Summary</h2>
              <p>Total Attendees: <strong>{attendees.length}</strong></p>
            </div>
            <div className={styles.actions}>
              <motion.button
                onClick={() => setShowCameraModal(true)}
                className={styles.iconBtn}
                disabled={faceMatchLoading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Find by Face"
              >
                <Camera size={20} />
              </motion.button>
              <motion.button
                onClick={downloadCSV}
                className={styles.iconBtn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Download CSV"
              >
                <Download size={20} />
              </motion.button>
            </div>
          </div>

          {/* Face Match Error */}
          <AnimatePresence>
            {faceMatchError && (
              <motion.div
                className={styles.faceMatchError}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <strong>Face Match Error:</strong> {faceMatchError}
                <button onClick={() => setFaceMatchError(null)} className={styles.dismissBtn}>✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Face Match Loading */}
          <AnimatePresence>
            {faceMatchLoading && (
              <motion.div
                className={styles.faceMatchLoading}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.spinner}></div>
                <p>Analyzing face and matching with attendees...</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.tableContainer} style={{ position: 'relative' }}>
            {/* Scraping Loading Overlay */}
            <AnimatePresence>
              {isScrapingInProgress && (
                <motion.div
                  className={styles.tableLoadingOverlay}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={styles.tableLoadingContent}>
                    <div className={styles.spinner}></div>
                    <h3>Enriching LinkedIn Profiles</h3>
                    <p>Fetching profile data from LinkedIn...</p>
                    <p className={styles.loadingProgress}>
                      {progress?.completed || 0} / {progress?.total || 0} completed
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <table className={styles.table} ref={tableRef}>
              <thead>
                <tr>
                  <th>Expand</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Headline</th>
                  <th>Events</th>
                  <th>Tech Summary</th>
                  <th>Collab Summary</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Socials</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((attendee, index) => (
                  <>
                    <motion.tr
                      key={index}
                      ref={matchedRowIndex === index ? matchedRowRef : null}
                      className={matchedRowIndex === index ? styles.matchedRow : ''}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <td>
                        <motion.button
                          onClick={() => openDetailsModal(attendee)}
                          className={styles.expandBtn}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="View full details"
                        >
                          <Eye size={18} />
                        </motion.button>
                      </td>
                      <td>
                        {attendee.linkedinData?.profile_photo ? (
                          <img
                            src={attendee.linkedinData.profile_photo}
                            alt={attendee.name}
                            className={styles.profilePhoto}
                          />
                        ) : (
                          <div className={styles.noPhoto}>👤</div>
                        )}
                      </td>
                      <td>
                        <strong>{attendee.name}</strong>
                        <br />
                        <a href={attendee.profileUrl} target="_blank" rel="noopener noreferrer" className={styles.smallLink}>
                          Luma Profile
                        </a>
                      </td>
                      <td className={styles.headline}>
                        {attendee.linkedinData?.headline || (
                          attendee.scrapingStatus === 'pending' ? (
                            <span className={styles.loading}>Loading...</span>
                          ) : '-'
                        )}
                      </td>
                      <td>{attendee.eventsAttended || 0}</td>
                      <td className={styles.summaryCell}>
                        {attendee.technical_skill_summary || '-'}
                      </td>
                      <td className={styles.summaryCell}>
                        {attendee.collaboration_summary || '-'}
                      </td>
                      <td className={styles.summaryCell}>
                        {attendee.summary || '-'}
                      </td>
                      <td>
                        <span className={`${styles.status} ${styles[attendee.scrapingStatus || 'no_linkedin']}`}>
                          {attendee.scrapingStatus === 'pending' && 'Loading'}
                          {attendee.scrapingStatus === 'completed' && 'Done'}
                          {attendee.scrapingStatus === 'failed' && 'Failed'}
                          {attendee.scrapingStatus === 'no_linkedin' && 'No LinkedIn'}
                          {!attendee.scrapingStatus && '-'}
                        </span>
                      </td>
                      <td className={styles.socials}>
                        {attendee.linkedin && (
                          <a href={attendee.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn">
                            <Linkedin size={16} />
                          </a>
                        )}
                        {attendee.instagram && (
                          <a href={attendee.instagram} target="_blank" rel="noopener noreferrer" title="Instagram">
                            <Instagram size={16} />
                          </a>
                        )}
                        {attendee.x && (
                          <a href={attendee.x} target="_blank" rel="noopener noreferrer" title="X (Twitter)">
                            <Twitter size={16} />
                          </a>
                        )}
                        {attendee.website && (
                          <a href={attendee.website} target="_blank" rel="noopener noreferrer" title="Website">
                            <Globe size={16} />
                          </a>
                        )}
                      </td>
                    </motion.tr>
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Attendee Details Modal */}
      <AttendeeDetailsModal
        isOpen={showDetailsModal}
        onClose={closeDetailsModal}
        attendee={selectedAttendee}
      />

      {/* Camera Modal */}
      <CameraModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCameraCapture}
      />

      {/* Match Result Modal */}
      <MatchResult
        isOpen={showMatchResult}
        onClose={() => {
          setShowMatchResult(false);
          setMatchedRowIndex(null);
        }}
        matchData={matchData}
      />
    </div>
  );
}

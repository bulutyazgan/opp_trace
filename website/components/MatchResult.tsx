'use client';

import styles from './MatchResult.module.css';

interface MatchResultProps {
  isOpen: boolean;
  onClose: () => void;
  matchData: {
    profile: any;
    confidence: number;
    distance: number;
    verified: boolean;
  } | null;
}

export default function MatchResult({ isOpen, onClose, matchData }: MatchResultProps) {
  if (!isOpen || !matchData) return null;

  const { profile, confidence, verified } = matchData;
  const linkedinData = profile.linkedinData;
  const confidencePercent = (confidence * 100).toFixed(1);

  // Get confidence color based on percentage
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return '#10b981'; // Green
    if (conf >= 0.6) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Match Found! 🎉</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Confidence Score - Only show for non-verified matches */}
          <div className={styles.confidenceSection}>
            {!verified && (
              <div className={styles.confidenceBadge} style={{ background: getConfidenceColor(confidence) }}>
                {confidencePercent}% Match
              </div>
            )}
            <p className={styles.verifiedText}>
              {verified ? '✓ Verified Match' : 'Possible Match'}
            </p>
          </div>

          {/* Profile Card */}
          <div className={styles.profileCard}>
            {linkedinData?.profile_photo && (
              <div className={styles.photoContainer}>
                <img
                  src={linkedinData.profile_photo}
                  alt={profile.name}
                  className={styles.profilePhoto}
                />
              </div>
            )}

            <div className={styles.profileInfo}>
              <h3 className={styles.name}>{profile.name}</h3>

              {linkedinData?.headline && (
                <p className={styles.headline}>{linkedinData.headline}</p>
              )}

              {linkedinData?.location && (
                <p className={styles.location}>📍 {linkedinData.location}</p>
              )}

              {linkedinData?.connections && (
                <p className={styles.connections}>🔗 {linkedinData.connections} connections</p>
              )}
            </div>
          </div>

          {/* About Section */}
          {linkedinData?.about && (
            <div className={styles.section}>
              <h4>About</h4>
              <p className={styles.about}>{linkedinData.about}</p>
            </div>
          )}

          {/* Experience Section */}
          {linkedinData?.experience && linkedinData.experience.length > 0 && (
            <div className={styles.section}>
              <h4>Experience</h4>
              <div className={styles.experienceList}>
                {linkedinData.experience.slice(0, 3).map((exp: any, index: number) => (
                  <div key={index} className={styles.experienceItem}>
                    <div className={styles.expTitle}>{exp.position || 'Position'}</div>
                    <div className={styles.expCompany}>{exp.company_name || 'Company'}</div>
                    {exp.duration && (
                      <div className={styles.expDuration}>{exp.duration}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education Section */}
          {linkedinData?.education && linkedinData.education.length > 0 && (
            <div className={styles.section}>
              <h4>Education</h4>
              <div className={styles.educationList}>
                {linkedinData.education.slice(0, 2).map((edu: any, index: number) => (
                  <div key={index} className={styles.educationItem}>
                    <div className={styles.eduSchool}>{edu.college_name || 'School'}</div>
                    <div className={styles.eduDegree}>
                      {edu.college_degree} {edu.college_degree_field && `in ${edu.college_degree_field}`}
                    </div>
                    {edu.college_duration && (
                      <div className={styles.eduDuration}>{edu.college_duration}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scores Section */}
          {profile.overall_score && (
            <div className={styles.section}>
              <h4>Hackathon Scores</h4>
              <div className={styles.scoresGrid}>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreLabel}>Overall Score</div>
                  <div className={styles.scoreValue}>{profile.overall_score}/100</div>
                </div>
                {profile.hackathons_won && (
                  <div className={styles.scoreItem}>
                    <div className={styles.scoreLabel}>Hackathons Won</div>
                    <div className={styles.scoreValue}>{profile.hackathons_won}</div>
                  </div>
                )}
              </div>

              {profile.summary && (
                <div className={styles.summary}>
                  <strong>Summary:</strong> {profile.summary}
                </div>
              )}
            </div>
          )}

          {/* Social Links */}
          <div className={styles.socialLinks}>
            {profile.linkedin && (
              <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                LinkedIn Profile →
              </a>
            )}
            {profile.profileUrl && (
              <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                Luma Profile →
              </a>
            )}
          </div>

          {/* Close Button */}
          <div className={styles.footer}>
            <button onClick={onClose} className={styles.closeBtn}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

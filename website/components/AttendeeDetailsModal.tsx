'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Linkedin, Twitter, Instagram, Globe, Award, Briefcase, GraduationCap } from 'lucide-react';
import styles from './AttendeeDetailsModal.module.css';

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
  linkedinData?: LinkedInProfile | null;
  hackathons_won?: number | string | null;
  overall_score?: number | null;
  technical_skill_summary?: string | null;
  collaboration_summary?: string | null;
  summary?: string | null;
}

interface AttendeeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendee: Attendee | null;
}

export default function AttendeeDetailsModal({ isOpen, onClose, attendee }: AttendeeDetailsModalProps) {
  if (!attendee) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                {attendee.linkedinData?.profile_photo ? (
                  <img
                    src={attendee.linkedinData.profile_photo}
                    alt={attendee.name}
                    className={styles.profilePhoto}
                  />
                ) : (
                  <div className={styles.noPhoto}>👤</div>
                )}
                <div>
                  <h2 className={styles.name}>{attendee.name}</h2>
                  {attendee.linkedinData?.headline && (
                    <p className={styles.headline}>{attendee.linkedinData.headline}</p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className={styles.closeBtn}>
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
              {/* Scoring Metrics */}
              <div className={styles.metricsRow}>
                {attendee.overall_score !== null && attendee.overall_score !== undefined && (
                  <div className={styles.metric}>
                    <Award className={styles.metricIcon} size={20} />
                    <div>
                      <div className={styles.metricLabel}>Overall Score</div>
                      <div className={styles.metricValue}>{attendee.overall_score}/100</div>
                    </div>
                  </div>
                )}
                {attendee.hackathons_won !== null && attendee.hackathons_won !== undefined && (
                  <div className={styles.metric}>
                    <Award className={styles.metricIcon} size={20} />
                    <div>
                      <div className={styles.metricLabel}>Hackathons Won</div>
                      <div className={styles.metricValue}>{attendee.hackathons_won}</div>
                    </div>
                  </div>
                )}
                {attendee.eventsAttended !== undefined && (
                  <div className={styles.metric}>
                    <Award className={styles.metricIcon} size={20} />
                    <div>
                      <div className={styles.metricLabel}>Events Attended</div>
                      <div className={styles.metricValue}>{attendee.eventsAttended}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Socials */}
              {(attendee.linkedin || attendee.instagram || attendee.x || attendee.website) && (
                <div className={styles.socials}>
                  {attendee.linkedin && (
                    <a href={attendee.linkedin} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                      <Linkedin size={16} /> LinkedIn
                    </a>
                  )}
                  {attendee.instagram && (
                    <a href={attendee.instagram} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                      <Instagram size={16} /> Instagram
                    </a>
                  )}
                  {attendee.x && (
                    <a href={attendee.x} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                      <Twitter size={16} /> X
                    </a>
                  )}
                  {attendee.website && (
                    <a href={attendee.website} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                      <Globe size={16} /> Website
                    </a>
                  )}
                </div>
              )}

              {/* AI Summaries */}
              {attendee.summary && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Overall Summary</h3>
                  <p className={styles.sectionContent}>{attendee.summary}</p>
                </div>
              )}

              {attendee.technical_skill_summary && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Technical Skills</h3>
                  <p className={styles.sectionContent}>{attendee.technical_skill_summary}</p>
                </div>
              )}

              {attendee.collaboration_summary && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Collaboration & Teamwork</h3>
                  <p className={styles.sectionContent}>{attendee.collaboration_summary}</p>
                </div>
              )}

              {/* About */}
              {attendee.linkedinData?.about && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>About</h3>
                  <p className={styles.sectionContent}>{attendee.linkedinData.about}</p>
                </div>
              )}

              {/* Experience */}
              {attendee.linkedinData?.experience && attendee.linkedinData.experience.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <Briefcase size={18} /> Experience
                  </h3>
                  <div className={styles.listContainer}>
                    {attendee.linkedinData.experience.map((exp, i) => (
                      <div key={i} className={styles.listItem}>
                        <strong className={styles.listItemTitle}>{exp.position}</strong>
                        <div className={styles.listItemMeta}>
                          {exp.company_name} • {exp.duration}
                        </div>
                        {exp.location && (
                          <div className={styles.listItemDetail}>{exp.location}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {attendee.linkedinData?.education && attendee.linkedinData.education.length > 0 && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <GraduationCap size={18} /> Education
                  </h3>
                  <div className={styles.listContainer}>
                    {attendee.linkedinData.education.map((edu, i) => (
                      <div key={i} className={styles.listItem}>
                        <strong className={styles.listItemTitle}>{edu.college_name}</strong>
                        {edu.college_degree && (
                          <div className={styles.listItemMeta}>
                            {edu.college_degree}
                            {edu.college_degree_field && ` - ${edu.college_degree_field}`}
                          </div>
                        )}
                        {edu.college_duration && (
                          <div className={styles.listItemDetail}>{edu.college_duration}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

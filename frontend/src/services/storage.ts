export function sessionsKey(email?: string) {
  const safe = email && email.trim() ? email.trim().toLowerCase() : 'guest';
  return `intervai-sessions:${safe}`;
}

export function resumeKey(email?: string) {
  const safe = email && email.trim() ? email.trim().toLowerCase() : 'guest';
  return `intervai-resume-analysis:${safe}`;
}

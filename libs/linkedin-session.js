import fs from 'fs';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'linkedin-sessions');

export class LinkedInSessionManager {
  constructor() {
    this.ensureSessionsDir();
  }

  ensureSessionsDir() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
  }

  // Save session data
  saveSession(sessionId, email, cookies, localStorage, sessionStorage, profileImageUrl = null, userName = null) {
    const sessionData = {
      sessionId,
      email,
      userName,
      cookies,
      localStorage,
      sessionStorage,
      profileImageUrl,
      isActive: false, // Default to inactive
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
    
    return sessionFile;
  }

  // Load session data
  loadSession(sessionId) {
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    
    if (!fs.existsSync(sessionFile)) {
      return null;
    }

    try {
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      
      // Update last used timestamp
      sessionData.lastUsed = new Date().toISOString();
      fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
      
      return sessionData;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  // Get all sessions
  getAllSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(SESSIONS_DIR);
    const sessions = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        const session = this.loadSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  }

  // Delete session
  deleteSession(sessionId) {
    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
      return true;
    }
    
    return false;
  }

  // Clean up old sessions (older than 30 days)
  cleanupOldSessions() {
    const sessions = this.getAllSessions();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let cleanedCount = 0;
    
    for (const session of sessions) {
      if (new Date(session.lastUsed) < thirtyDaysAgo) {
        if (this.deleteSession(session.sessionId)) {
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  // Get session by email
  getSessionByEmail(email) {
    const sessions = this.getAllSessions();
    return sessions.find(session => session.email === email);
  }

  // Check if session exists and is valid
  isSessionValid(sessionId) {
    const session = this.loadSession(sessionId);
    return session !== null;
  }

  // Update session status (like isActive)
  updateSessionStatus(sessionId, updates) {
    const session = this.loadSession(sessionId);
    if (!session) {
      return false;
    }

    // Update the session data
    const updatedSession = {
      ...session,
      ...updates,
      lastUsed: new Date().toISOString()
    };

    const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(updatedSession, null, 2));
    
    return true;
  }
}

export default LinkedInSessionManager;

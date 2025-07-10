/**
 * Simple in-memory session manager to track user states for multi-step interactions
 */
class SessionManager {
  constructor() {
    // Map of user ID to their session data
    this.sessions = new Map();
    
    // Clean up sessions every hour
    setInterval(() => this.cleanupSessions(), 3600000);
  }
  
  /**
   * Get session data for a user
   * @param {Number} userId - The Telegram user ID
   * @returns {Object} - User's session data or empty object
   */
  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        lastActivity: Date.now()
      });
    } else {
      // Update last activity
      const session = this.sessions.get(userId);
      session.lastActivity = Date.now();
      this.sessions.set(userId, session);
    }
    
    return this.sessions.get(userId);
  }
  
  /**
   * Update a user's session data
   * @param {Number} userId - The Telegram user ID
   * @param {Object} data - The data to update
   */
  updateSession(userId, data) {
    const session = this.getSession(userId);
    this.sessions.set(userId, {
      ...session,
      ...data,
      lastActivity: Date.now()
    });
  }
  
  /**
   * Remove a specific key from a user's session
   * @param {Number} userId - The Telegram user ID
   * @param {String} key - The key to remove
   */
  removeSessionKey(userId, key) {
    if (!this.sessions.has(userId)) return;
    
    const session = this.sessions.get(userId);
    if (session[key]) {
      delete session[key];
      this.sessions.set(userId, {
        ...session,
        lastActivity: Date.now()
      });
    }
  }
  
  /**
   * Clear a user's session data
   * @param {Number} userId - The Telegram user ID
   */
  clearSession(userId) {
    this.sessions.set(userId, {
      lastActivity: Date.now()
    });
  }
  
  /**
   * Clean up inactive sessions (older than 2 hours)
   */
  cleanupSessions() {
    const now = Date.now();
    const expirationTime = 2 * 60 * 60 * 1000; // 2 hours
    
    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > expirationTime) {
        this.sessions.delete(userId);
      }
    }
  }
}

module.exports = new SessionManager();

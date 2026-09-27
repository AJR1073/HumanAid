const admin = require('firebase-admin');

function firebaseAuth() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    admin.initializeApp(projectId ? { projectId } : undefined);
  }
  return admin.auth();
}

async function verifyFirebaseIdToken(token) {
  return firebaseAuth().verifyIdToken(token, true);
}

async function getFirebaseUser(uid) {
  return firebaseAuth().getUser(uid);
}

function createAuthMiddleware({ pool, verifyIdToken = verifyFirebaseIdToken }) {
  async function verifyFirebaseToken(req, res, next) {
    if (req.auth) return next();
    const authorization = req.headers.authorization;
    if (!authorization) return next();
    const match = typeof authorization === 'string' && authorization.match(/^Bearer ([^\s,]+)$/i);
    if (!match || match[1].length > 8192) {
      return res.status(401).json({ error: 'A valid Firebase ID token is required' });
    }
    try {
      const decoded = await verifyIdToken(match[1]);
      if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid || decoded.uid.length > 128) {
        return res.status(401).json({ error: 'A valid Firebase ID token is required' });
      }
      req.auth = {
        uid: decoded.uid,
        email: typeof decoded.email === 'string' ? decoded.email : null,
        emailVerified: decoded.email_verified === true,
        name: typeof decoded.name === 'string' ? decoded.name : null,
        picture: typeof decoded.picture === 'string' ? decoded.picture : null
      };
      return next();
    } catch {
      // SDK errors can include tokens or infrastructure details.
      return res.status(401).json({ error: 'A valid Firebase ID token is required' });
    }
  }

  function requireAuthenticatedUser(req, res, next) {
    return verifyFirebaseToken(req, res, () => {
      if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
      return next();
    });
  }

  async function requireAdmin(req, res, next) {
    if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
    if (req.auth.emailVerified !== true || !req.auth.email) {
      return res.status(403).json({ error: 'A verified administrator email is required' });
    }
    try {
      const result = await pool.query(
        'SELECT id, is_admin, is_active FROM users WHERE firebase_uid = $1',
        [req.auth.uid]
      );
      const user = result.rows[0];
      if (!user || user.is_admin !== true || user.is_active !== true) {
        return res.status(403).json({ error: 'Administrator access required' });
      }
      req.adminUser = { id: user.id };
      return next();
    } catch {
      return res.status(503).json({ error: 'Authorization is temporarily unavailable' });
    }
  }

  return { verifyFirebaseToken, requireAuthenticatedUser, requireAdmin };
}

function requireOwnIdentity({ email = false, uidFields = ['uid', 'firebase_uid', 'user_id'] } = {}) {
  return (req, res, next) => {
    for (const source of [req.body || {}, req.query || {}]) {
      if (['isAdmin', 'is_admin', 'admin', 'role'].some((key) => Object.hasOwn(source, key))) {
        return res.status(403).json({ error: 'Identity and roles are controlled by the server' });
      }
      for (const key of uidFields) {
        if (Object.hasOwn(source, key) && source[key] !== req.auth?.uid) {
          return res.status(403).json({ error: 'Cannot act on behalf of another user' });
        }
      }
      if (email && Object.hasOwn(source, 'email') && source.email !== req.auth?.email) {
        return res.status(403).json({ error: 'Cannot change the authenticated email address' });
      }
    }
    return next();
  };
}

module.exports = { createAuthMiddleware, requireOwnIdentity, getFirebaseUser };

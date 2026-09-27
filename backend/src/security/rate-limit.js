function createRateLimiter({ limit, windowMs, now = Date.now, maxEntries = 10000 }) {
  const clients = new Map();
  return (req, res, next) => {
    const time = now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let client = clients.get(key);
    if (!client || client.resetAt <= time) {
      if (clients.size >= maxEntries) {
        for (const [address, entry] of clients) {
          if (entry.resetAt <= time) clients.delete(address);
        }
      }
      if (!clients.has(key) && clients.size >= maxEntries) {
        res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
      client = { count: 0, resetAt: time + windowMs };
      clients.set(key, client);
    }
    client.count += 1;
    if (client.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((client.resetAt - time) / 1000))));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    return next();
  };
}

module.exports = { createRateLimiter };

// Bound anonymous demo writes without changing local development behavior.
// This is a per-process budget, not authentication or a distributed rate limit.
module.exports = function publicDemo(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.method !== 'POST' || !['/api/bins/report-fullness', '/api/student/impact'].includes(req.path)) {
    return res.status(403).json({ message: 'This action is disabled in the public synthetic demo.' });
  }
  const now = Date.now();
  if (now >= publicDemo.windowEnds) {
    publicDemo.windowEnds = now + 60000;
    publicDemo.writes = 0;
  }
  if (publicDemo.writes >= 30) {
    res.set('Retry-After', String(Math.ceil((publicDemo.windowEnds - now) / 1000)));
    return res.status(429).json({ message: 'The demo has reached its write limit. Please retry in a minute.' });
  }
  publicDemo.writes += 1;
  next();
};
module.exports.windowEnds = 0;
module.exports.writes = 0;

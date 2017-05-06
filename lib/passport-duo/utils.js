function getRandomInt(min, max) {
  return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

exports.randomKey = (len) => {
  const buf = [];
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charlen = chars.length;

  for (let i = 0; i < len; i += 1) {
    buf.push(chars[getRandomInt(0, charlen - 1)]);
  }

  return buf.join('');
};


/**
 * Reconstructs the original URL of the request.
 *
 * This function builds a URL that corresponds the original URL requested by the
 * client, including the protocol (http or https) and host.
 *
 * If the request passed through any proxies that terminate SSL, the
 * `X-Forwarded-Proto` header is used to detect if the request was encrypted to
 * the proxy, assuming that the proxy has been flagged as trusted.
 *
 * @param {http.IncomingMessage} req
 * @param {Object} [options]
 * @return {String}
 * @api private
 */
exports.originalURL = (req, options) => {
  const newOptions = options || {};
  const app = req.app;
  if (app && app.enabled && app.enabled('trust proxy')) {
    newOptions.proxy = true;
  }
  const trustProxy = newOptions.proxy;
  const proto = (req.headers['x-forwarded-proto'] || '').toLowerCase();
  const tls = req.connection.encrypted || (trustProxy && proto.split(/\s*,\s*/)[0]) === 'https';
  const host = (trustProxy && req.headers['x-forwarded-host']) || req.headers.host;
  const protocol = tls ? 'https' : 'http';
  const path = options.url || req.url || '';
  return `${protocol}://${host}${path}`;
};

// NOTE: This require will be replaced with `@sentry/browser`
// client side thanks to the webpack config in next.config.js
const Sentry = require('@sentry/node');

/**
 * Returns the Sentry environment based on env and current server.
 */
const getSentryEnvironment = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.WEBSITE_URL === 'https://staging.opencollective.com' ? 'staging' : 'production';
  } else {
    return process.env.NODE_ENV;
  }
};

/**
 * Initialize Sentry and export it.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: getSentryEnvironment(),
  attachStacktrace: true,
  release: process.env.SENTRY_RELEASE,
  enabled: process.env.NODE_ENV !== 'test',
  ignoreErrors: [/\[Please ignore this error\]/],
  blacklistUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
  ],
});

// Default scope
Sentry.configureScope(scope => {
  scope.setTag('nodejs', process.version);
  scope.setTag('runtimeEngine', typeof window !== 'undefined' ? 'browser' : 'server');
});

/**
 * Helper to extract Sentry tags from an error
 */
const captureException = (err, ctx) => {
  Sentry.configureScope(scope => {
    if (err.message) {
      // De-duplication currently doesn't work correctly for SSR / browser errors
      // so we force deduplication by error message if it is present
      scope.setFingerprint([err.message]);
    }

    if (err.statusCode) {
      scope.setExtra('statusCode', err.statusCode);
    }

    if (ctx) {
      const { req, res, errorInfo, query, pathname } = ctx;

      if (res && res.statusCode) {
        scope.setExtra('statusCode', res.statusCode);
      }

      if (typeof window !== 'undefined') {
        scope.setTag('ssr', false);
        scope.setExtra('query', query);
        scope.setExtra('pathname', pathname);
      } else {
        scope.setTag('ssr', true);
        scope.setExtra('url', req.url);
        scope.setExtra('method', req.method);
        scope.setExtra('headers', req.headers);
        scope.setExtra('params', req.params);
        scope.setExtra('query', req.query);
      }

      if (errorInfo) {
        Object.keys(errorInfo).forEach(key => scope.setExtra(key, errorInfo[key]));
      }
    }
  });

  return Sentry.captureException(err);
};

module.exports = { Sentry, captureException };
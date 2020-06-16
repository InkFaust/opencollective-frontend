const expressLimiter = require('express-limiter');
const redis = require('redis');

const logger = require('./logger');
const { parseToBooleanDefaultFalse } = require('./utils');

const redisServerUrl = process.env.REDIS_URL;

const enabled = parseToBooleanDefaultFalse(process.env.RATE_LIMITING_ENABLED);
const simulate = parseToBooleanDefaultFalse(process.env.RATE_LIMITING_SIMULATE);

// 10 requests / 60 seconds

const total = Number(process.env.RATE_LIMITING_TOTAL) || 10;
const expire = Number(process.env.RATE_LIMITING_EXPIRE) || 60;

const load = async app => {
  if (!enabled || !redisServerUrl) {
    return;
  }

  const client = redis.createClient(redisServerUrl);
  const rateLimiter = expressLimiter(app, client);

  const whitelist = req =>
    req.url.match(/^\/_/) || req.url.match(/^\/static/) || req.url.match(/^\/api/) || req.url.match(/^\/favicon\.ico/)
      ? true
      : false;

  rateLimiter({
    path: '*',
    method: 'all',
    lookup: 'ip',
    total: total,
    expire: expire * 1000,
    whitelist,
    onRateLimited: function (req, res) {
      logger.info(`Rate limit exceeded for ${req.ip}`);
      if (simulate) {
        return;
      }
      const message = 'Rate limit exceeded. Try again in a few seconds.';
      res.status(429).send(message);
    },
  });
};

module.exports = load;

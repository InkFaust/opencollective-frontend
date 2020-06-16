const hyperwatch = require('@hyperwatch/hyperwatch');
const expressBasicAuth = require('express-basic-auth');
const expressWs = require('express-ws');

const { parseToBooleanDefaultFalse } = require('./utils');

const {
  HYPERWATCH_ENABLED: enabled,
  HYPERWATCH_PATH: path,
  HYPERWATCH_USERNAME: username,
  HYPERWATCH_SECRET: secret,
} = process.env;

const load = async app => {
  if (parseToBooleanDefaultFalse(enabled) !== true) {
    return;
  }

  const { input, lib, modules, pipeline } = hyperwatch;

  // Mount Hyperwatch API and Websocket

  if (secret) {
    // We need to setup express-ws here to make Hyperwatch's websocket works
    expressWs(app);
    const hyperwatchBasicAuth = expressBasicAuth({
      users: { [username || 'opencollective']: secret },
      challenge: true,
    });
    app.use(path || '/_hyperwatch', hyperwatchBasicAuth, hyperwatch.app.api);
    app.use(path || '/_hyperwatch', hyperwatchBasicAuth, hyperwatch.app.websocket);
  }

  // Configure input

  const expressInput = input.express.create({ name: 'Hyperwatch Express Middleware' });

  app.use((req, res, next) => {
    req.ip = req.ip || '::1'; // Fix "Invalid message: data.request should have required property 'address'"
    next();
  });

  app.use(expressInput.middleware());

  pipeline.registerInput(expressInput);

  // Configure access Logs in dev and production

  const consoleLogOutput = process.env.NODE_ENV === 'development' ? 'console' : 'text';
  const consoleLogFormatter = new lib.formatter.Formatter(consoleLogOutput);
  pipeline
    .filter(log => !log.getIn(['request', 'url']).match(/^\/_/))
    .filter(log => !log.getIn(['request', 'url']).match(/^\/static/))
    .filter(log => !log.getIn(['request', 'url']).match(/^\/api/))
    .map(log => console.log(consoleLogFormatter.format(log)));

  // Start

  modules.load();

  pipeline.start();
};

module.exports = load;

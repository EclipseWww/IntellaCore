'use strict';

// Use Node rather than platform-specific shell environment assignments.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';
require('react-scripts/config/env');

// Preserve existing development defaults, allowing shell/.env.local overrides.
const defaults = {
  HOST: '0.0.0.0',
  FAST_REFRESH: 'false',
  DANGEROUSLY_DISABLE_HOST_CHECK: 'true',
};
for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// Leave WDS_SOCKET_HOST/PORT unset so remote browsers use their own page URL.
require('react-scripts/scripts/start');

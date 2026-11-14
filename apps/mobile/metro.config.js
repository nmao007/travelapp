// Let Metro bundle the shared trip logic in packages/core (imported as
// @trippilot/core/* through the tsconfig path alias).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../../packages/core')];
module.exports = config;

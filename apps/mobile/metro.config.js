const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo wiring: Metro must watch the whole workspace so edits to
// @carbuddy/domain hot-reload, and must resolve from both node_modules trees
// because npm hoists most packages to the root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup is deliberately left enabled (Metro's default). Turning it
// off restricts resolution to `nodeModulesPaths` only, which breaks any package
// npm chose not to hoist — `expo-asset`, for instance, installs nested under
// `node_modules/expo/node_modules` and becomes unresolvable, failing the release
// bundle with "Unable to resolve module expo-asset".

module.exports = config;

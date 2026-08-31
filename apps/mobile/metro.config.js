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
// Without this, a package hoisted to the root can be resolved twice and load
// two copies of React.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

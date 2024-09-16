const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const customConfig = {};

module.exports = mergeConfig(defaultConfig, customConfig);

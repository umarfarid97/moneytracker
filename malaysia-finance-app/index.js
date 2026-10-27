// Entry point: browser fixes must load before any library code runs.
require('./src/polyfills');
require('expo-router/entry');

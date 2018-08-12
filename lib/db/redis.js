'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hsetAsync = exports.hgetAsync = exports.client = undefined;

var _redis = require('redis');

var _redis2 = _interopRequireDefault(_redis);

var _util = require('util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const client = exports.client = _redis2.default.createClient();

const hgetAsync = exports.hgetAsync = (0, _util.promisify)(client.hget).bind(client);
const hsetAsync = exports.hsetAsync = (0, _util.promisify)(client.hset).bind(client);

const debug = require('debug')('laa:cwc:redis');

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on('error', err => {
  debug('Error', err);
});

client.on('connect', () => {
  debug('Redis connected');
});
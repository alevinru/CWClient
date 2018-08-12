'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ACTION_GRANT_TOKEN = exports.ACTION_AUTH_SEND = exports.ACTION_WTB = exports.ACTION_REQUEST_STOCK = exports.ACTION_GET_INFO = exports.ACTION_PROFILE = undefined;

var _matches = require('lodash/matches');

var _matches2 = _interopRequireDefault(_matches);

var _map = require('lodash/map');

var _map2 = _interopRequireDefault(_map);

var _each = require('lodash/each');

var _each2 = _interopRequireDefault(_each);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = require('debug')('laa:cwc:MessageCache');

const ACTION_PROFILE = exports.ACTION_PROFILE = 'requestProfile';
const ACTION_GET_INFO = exports.ACTION_GET_INFO = 'getInfo';
const ACTION_REQUEST_STOCK = exports.ACTION_REQUEST_STOCK = 'requestStock';
const ACTION_WTB = exports.ACTION_WTB = 'wantToBuy';
const ACTION_AUTH_SEND = exports.ACTION_AUTH_SEND = 'createAuthCode';
const ACTION_GRANT_TOKEN = exports.ACTION_GRANT_TOKEN = 'grantToken';

class MessageCache {

  constructor() {

    this.types = {
      [ACTION_PROFILE]: {},
      [ACTION_GET_INFO]: {},
      [ACTION_REQUEST_STOCK]: {},
      [ACTION_WTB]: {},
      [ACTION_AUTH_SEND]: {},
      [ACTION_GRANT_TOKEN]: {}
    };
  }

  popById(type, messageId) {

    const typeMessages = this.types[type];
    delete typeMessages[messageId];
  }

  push(type, key = type, message) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];
    const { messageId } = message;

    typeMessages[stringKey] = typeMessages[stringKey] || {};
    typeMessages[stringKey][messageId] = message;

    debug('push:', type, key);

    return messageId;
  }

  pop(type, key = type) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];
    const messages = typeMessages[stringKey] || {};

    debug('pop:', type, key);

    return (0, _map2.default)(messages, (message, messageId) => {
      delete typeMessages[messageId];
      return message;
    });
  }

  popByPredicate(type, predicate) {

    const typeMessages = this.types[type];
    const filtered = [];
    const match = (0, _matches2.default)(predicate);

    (0, _each2.default)(typeMessages, (messagesById, key) => {
      (0, _each2.default)(messagesById, (message, messageId) => {
        if (match(message)) {
          filtered.push({ message, key, messageId });
        }
      });
    });

    debug('popByPredicate:', type, predicate, filtered.length);

    return (0, _map2.default)(filtered, ({ message, key, messageId }) => {
      delete typeMessages[key][messageId];
      return message;
    });
  }

}
exports.default = MessageCache;
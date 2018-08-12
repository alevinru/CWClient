import matches from 'lodash/matches';
import map from 'lodash/map';
import each from 'lodash/each';

const debug = require('debug')('laa:cwc:MessageCache');

export const ACTION_PROFILE = 'requestProfile';
export const ACTION_GET_INFO = 'getInfo';
export const ACTION_REQUEST_STOCK = 'requestStock';
export const ACTION_WTB = 'wantToBuy';
export const ACTION_AUTH_SEND = 'createAuthCode';
export const ACTION_GRANT_TOKEN = 'grantToken';

export default class MessageCache {

  constructor() {

    this.types = {
      [ACTION_PROFILE]: {},
      [ACTION_GET_INFO]: {},
      [ACTION_REQUEST_STOCK]: {},
      [ACTION_WTB]: {},
      [ACTION_AUTH_SEND]: {},
      [ACTION_GRANT_TOKEN]: {},
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

    return map(messages, (message, messageId) => {
      delete typeMessages[messageId];
      return message;
    });

  }

  popByPredicate(type, predicate) {

    const typeMessages = this.types[type];
    const filtered = [];
    const match = matches(predicate);

    each(typeMessages, (messagesById, key) => {
      each(messagesById, (message, messageId) => {
        if (match(message)) {
          filtered.push({ message, key, messageId });
        }
      });
    });

    debug('popByPredicate:', type, predicate, filtered.length);

    return map(filtered, ({ message, key, messageId }) => {
      delete typeMessages[key][messageId];
      return message;
    });

  }

}

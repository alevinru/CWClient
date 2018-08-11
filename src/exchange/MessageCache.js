import v4 from 'uuid/v4';
import matches from 'lodash/matches';
import map from 'lodash/map';
import each from 'lodash/each';

const debug = require('debug')('laa:cwc:MessageCache');

export const ACTION_PROFILE = 'requestProfile';

export class MessageCache {

  constructor() {

    this.types = {
      [ACTION_PROFILE]: {},
    };

  }

  popById(type, messageId) {

    const typeMessages = this.types[type];
    delete typeMessages[messageId];

  }

  push(type, key, message = {}) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];
    const id = v4();

    typeMessages[stringKey] = typeMessages[stringKey] || {};
    typeMessages[stringKey][id] = message;

    debug('push:', type, key);

    return id;

  }

  pop(type, key) {

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

import v4 from 'uuid/v4';

const debug = require('debug')('laa:cwc:MessageCache');

export const ACTION_PROFILE = 'requestProfile';

export class MessageCache {

  constructor() {

    this.types = {
      [ACTION_PROFILE]: {},
    };

  }

  push(type, key, options = {}) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];
    const id = v4();

    typeMessages[stringKey] = typeMessages[stringKey] || {};
    typeMessages[stringKey][id] = options;

    return id;

  }

  pop(type, key) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];

    debug('pop:', type, key);

    const messages = typeMessages[stringKey] || {};

    return Object.keys(messages).map(messageId => {
      const message = messages[messageId];
      delete messages[messageId];
      return message;
    });

  }

}

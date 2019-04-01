import matches from 'lodash/matches';
import map from 'lodash/map';
import each from 'lodash/each';

const debug = require('debug')('laa:cwc:MessageCache');

export const ACTION_PROFILE = 'requestProfile';
export const ACTION_GET_INFO = 'getInfo';
export const ACTION_GUILD_INFO = 'guildInfo';
export const ACTION_CRAFT_BOOK = 'viewCraftbook';
export const ACTION_REQUEST_STOCK = 'requestStock';
export const ACTION_GEAR_INFO = 'requestGearInfo';
export const ACTION_WTB = 'wantToBuy';
export const ACTION_AUTH_SEND = 'createAuthCode';
export const ACTION_GRANT_TOKEN = 'grantToken';
export const ACTION_AUTH_ADDITIONAL = 'authAdditionalOperation';
export const ACTION_GRANT_ADDITIONAL = 'grantAdditionalOperation';

export default class MessageCache {

  constructor() {

    this.types = {
      [ACTION_PROFILE]: {},
      [ACTION_GET_INFO]: {},
      [ACTION_REQUEST_STOCK]: {},
      [ACTION_WTB]: {},
      [ACTION_AUTH_SEND]: {},
      [ACTION_GRANT_TOKEN]: {},
      [ACTION_GUILD_INFO]: {},
      [ACTION_AUTH_ADDITIONAL]: {},
      [ACTION_GRANT_ADDITIONAL]: {},
      [ACTION_CRAFT_BOOK]: {},
      [ACTION_GEAR_INFO]: {},
    };

  }

  popByMessageId(type, messageId) {

    const typeMessages = this.types[type];
    each(typeMessages, messagesById => {
      // eslint-disable-next-line
      delete messagesById[messageId];
    });

  }

  push(type, key = type, message) {

    const stringKey = key.toString();
    const typeMessages = this.types[type];
    const { messageId } = message;

    if (!typeMessages[stringKey]) {
      typeMessages[stringKey] = {};
    }

    typeMessages[stringKey][messageId] = message;

    debug('push:', type, key, messageId);

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

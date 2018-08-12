import { connect as amqpConnect } from 'amqp-connection-manager';
import v4 from 'uuid/v4';
import MessageCache, {
  ACTION_PROFILE, ACTION_GET_INFO, ACTION_REQUEST_STOCK, ACTION_WTB, ACTION_AUTH_SEND, ACTION_GRANT_TOKEN,
} from './MessageCache';
import database from '../db';
import itemsByName from '../db/itemsByName';

const {
  APP_NAME, ACCESS_TOKEN, API_URL, AMQP_PROTOCOL,
} = process.env;

const debug = require('debug')('laa:cwc:exchange');

const EX = queueName('ex');
const QUEUE_I = queueName('i');
const QUEUE_O = queueName('o');

const QUEUE_DEALS = queueName('deals');
const QUEUE_OFFERS = queueName('offers');
const QUEUE_SEX = queueName('sex_digest');
const QUEUE_AU = queueName('au_digest');

const CW_TIMEOUT = parseInt(process.env.CW_TIMEOUT, 0) || 5000;

const CW_RESPONSE_OK = 'Ok';
const CW_RESPONSE_NOT_REGISTERED = 'NotRegistered';
const CW_RESPONSE_BAD_FORMAT = 'BadFormat';

export const CW_RESPONSE_BATTLE_IS_NEAR = 'BattleIsNear';
export const CW_RESPONSE_WRONG_USER_ID = 'NoSuchUser';
export const CW_RESPONSE_NO_OFFERS = 'NoOffersFoundByPrice';
export const CW_RESPONSE_INVALID_CODE = 'InvalidCode';
export const CW_RESPONSE_INVALID_TOKEN = 'InvalidToken';

export const NOT_FOUND = 'Not found';
export const TIMED_OUT = 'Time out request to CW';

export default class CWExchange {

  constructor() {

    debug('Init', API_URL, APP_NAME);

    this.cache = new MessageCache();

  }

  connect() {

    const manager = amqpConnect([`${AMQP_PROTOCOL}://${APP_NAME}:${ACCESS_TOKEN}@${API_URL}`]);

    manager.on('connect', () => {
      debug('Manager connected');
    });

    manager.on('disconnect', params => {
      debug('Manager disconnected', params.err.stack);
    });

    manager.createChannel({

      json: true,

      setup: channel => {

        debug('Got a channel');

        this.channel = channel;

        return channel.checkExchange(EX, '', { durable: true })
          .then(() => onCheckExchange(channel, this.cache));

      },

    });

  }

  publish(msg, messageId = v4()) {
    const options = { messageId };
    return this.channel.publish(EX, QUEUE_O, Buffer.from(JSON.stringify(msg)), options);
  }

  sendMessage(message, domainKey) {

    const { action } = message;
    const messageId = v4();

    debug('sendMessage', action, messageId);

    return new Promise((resolve, reject) => {

      const onTimeout = () => {
        debug('sendMessage onTimeout', messageId);
        this.cache.popById(action, messageId);
        reject(TIMED_OUT);
      };

      const timeOut = setTimeout(onTimeout, CW_TIMEOUT);
      const options = Object.assign({ resolve, reject, timeOut }, message);

      this.cache.push(action, domainKey, options);

      try {
        this.publish(message, messageId);
      } catch (err) {
        reject(err);
      }

    });

  }

  /**

   CW API protocol

   */

  sendAuth(userId) {

    const message = {
      action: ACTION_AUTH_SEND,
      payload: { userId },
    };

    debug('sendAuth to:', userId);

    return this.sendMessage(message, userId);

  }

  sendGrantToken(userId, authCode) {

    const message = {
      action: ACTION_GRANT_TOKEN,
      payload: { userId, authCode },
    };

    debug('sendGrantToken', message);

    return this.sendMessage(message, userId);

  }

  getInfo() {
    return this.sendMessage({ action: ACTION_GET_INFO });
  }

  async wantToBy(userId, params) {

    const {
      itemCode, quantity, price, exactPrice = true,
    } = params;

    const tokenData = await database.tokenByUserId(userId);

    if (!tokenData) {
      return Promise.reject(NOT_FOUND);
    }

    const message = {
      action: ACTION_WTB,
      token: tokenData.token,
      payload: {
        itemCode, quantity: parseInt(quantity, 0), price: parseInt(price, 0), exactPrice,
      },
    };

    const dealKey = `${userId}_${itemCode}_${quantity}`;

    return this.sendMessage(message, dealKey);

  }

  async requestStock(userId) {

    const tokenData = await database.tokenByUserId(userId);

    if (!tokenData) {
      return Promise.reject(NOT_FOUND);
    }

    const message = {
      action: ACTION_REQUEST_STOCK,
      token: tokenData.token,
    };

    return this.sendMessage(message, userId);

  }

  async requestProfile(userId) {

    const tokenData = await database.tokenByUserId(userId);

    if (!tokenData) {
      return Promise.reject(NOT_FOUND);
    }

    const message = {
      action: ACTION_PROFILE,
      token: tokenData.token,
    };

    return this.sendMessage(message, userId);

  }

}


/*
Private
 */


async function onCheckExchange(ch, cache) {

  debug('CheckExchange success');

  await ch.bindQueue(QUEUE_O, EX);

  debug('Bind success', QUEUE_O);

  // await ch.consume(QUEUE_I, onConsumeResolve)
  //   .then(onConsumeInit(QUEUE_I));
  //
  // await ch.consume(QUEUE_DEALS, onConsumeLog)
  //   .then(onConsumeInit(QUEUE_DEALS));
  //
  // await ch.consume(QUEUE_AU, onConsumeLog)
  //   .then(onConsumeInit(QUEUE_AU));
  //
  // await ch.consume(QUEUE_SEX, onConsumeLog)
  //   .then(onConsumeInit(QUEUE_SEX));
  //
  // await ch.consume(QUEUE_OFFERS, onConsumeLog)
  //   .then(onConsumeInit(QUEUE_OFFERS));

  return ch;

  function onConsumeResolve(msg) {

    const { content } = msg;
    const { action, result, payload } = JSON.parse(content.toString());

    debug('onConsumeResolve', action, result, payload);

    const exceptions = checkExceptions();
    const responseCode = exceptions || action;

    switch (responseCode) {

      case CW_RESPONSE_INVALID_TOKEN: {
        processResponseException(action, result, payload);
        break;
      }

      case ACTION_GET_INFO: {
        processGetInfoResponse(result, payload);
        break;
      }

      case ACTION_WTB: {
        processWantToBuyResponse(result, payload);
        break;
      }

      case ACTION_GRANT_TOKEN:
      case ACTION_AUTH_SEND:
      case ACTION_REQUEST_STOCK:
      case ACTION_PROFILE: {

        processProfileResponse(responseCode, result, payload);
        break;

      }

      default: {
        debug('onConsumeResolve default', action);
      }

    }

    // const { exchange, deliveryTag } = fields;
    // debug('Consumed fields', fields);
    // debug('Consumed properties', properties);

    ch.ack(msg);

    function checkExceptions() {

      switch (result) {

        case CW_RESPONSE_INVALID_CODE: {
          const { userId } = payload;
          rejectCached(cache.pop(action, userId), CW_RESPONSE_INVALID_CODE);
          break;
        }

        case CW_RESPONSE_BAD_FORMAT:
        case CW_RESPONSE_BATTLE_IS_NEAR: {
          debug('checkExceptions', result);
          break;
        }

        case CW_RESPONSE_WRONG_USER_ID: {
          rejectCached(cache.popByPredicate(action, {}), result);
          break;
        }

        case CW_RESPONSE_INVALID_TOKEN: {
          const { token } = payload;
          rejectCached(cache.popByPredicate(action, { token }), result);
          break;
        }

        case CW_RESPONSE_NOT_REGISTERED: {
          resolveCached(cache.popByPredicate(action, {}), { status: CW_RESPONSE_NOT_REGISTERED });
          break;
        }

        default: {
          return false;
        }

      }

      return 'default';

    }

  }

  function resolveCached(messages, payload) {
    debug('resolveCached:', messages.length);
    messages.forEach(({ resolve, timeOut }) => {
      clearTimeout(timeOut);
      resolve(payload);
    });
  }

  function rejectCached(messages, payload) {
    debug('rejectCached:', messages.length);
    messages.forEach(({ reject, timeOut }) => {
      clearTimeout(timeOut);
      reject(payload);
    });
  }

  function processGetInfoResponse(result, payload) {

    const cached = cache.pop(ACTION_PROFILE);

    debug('processGetInfoResponse', ACTION_PROFILE, result);

    if (result === CW_RESPONSE_OK) {
      resolveCached(cached, payload);
    } else {
      rejectCached(cached, payload);
    }

  }

  function processResponseException(action, result, payload) {

    const { userId } = payload;
    const cached = cache.pop(action, userId);

    debug('processResponseException', action, result);

    if (result === CW_RESPONSE_INVALID_TOKEN) {
      rejectCached(cached, result);
    }

  }

  function processProfileResponse(action, result, payload) {

    const { userId } = payload;
    const cached = cache.pop(action, userId);

    debug('processProfileResponse', action, result);

    if (result === CW_RESPONSE_OK) {
      resolveCached(cached, payload);
    } else {
      rejectCached(cached, payload);
    }

  }

  function processWantToBuyResponse(result, payload) {

    const { itemName, quantity, userId } = payload;
    const itemCode = itemsByName[itemName];

    if (!itemCode) {
      debug('processWantToBuyResponse:', 'unknown itemName:', itemName);
      return;
    }

    const cached = cache.pop(ACTION_WTB, `${userId}_${itemCode}_${quantity}`);

    debug('processWantToBuyResponse', ACTION_WTB, result, itemName, quantity);

    switch (result) {

      case CW_RESPONSE_NO_OFFERS: {
        rejectCached(cached, CW_RESPONSE_NO_OFFERS);
        break;
      }

      case CW_RESPONSE_OK: {
        resolveCached(cached, payload);
        break;
      }

      default: {
        rejectCached(cached, payload);
      }

    }

  }

  function onConsumeLog(msg) {
    const { fields, properties, content } = msg;
    const { exchange, deliveryTag } = fields;
    debug('Consume', exchange, `#${deliveryTag}`, properties.timestamp, `${content.length} bytes`);
    debug('Consumed', exchange || 'private', content.toString());
    // debug('Consumed fields', fields);
    // debug('Consumed properties', properties);
    ch.ack(msg);
  }

  function onConsumeInit(queueName) {
    return () => debug('Consume init', queueName);
  }

}

function queueName(code) {
  return `${APP_NAME}_${code}`;
}

// function payload(content) {
//   return JSON.parse(content.toString());
// }

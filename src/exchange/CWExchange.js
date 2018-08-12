import { connect as amqpConnect } from 'amqp-connection-manager';
import v4 from 'uuid/v4';
import isString from 'lodash/isString';

import MessageCache, * as Msg from './MessageCache';
import database from '../db';
import itemsByName from '../db/itemsByName';

const {
  APP_NAME, ACCESS_TOKEN, API_URL, AMQP_PROTOCOL,
} = process.env;

const debug = require('debug')('laa:cwc:exchange');

const EX = 'ex';
const QUEUE_I = 'i';
const QUEUE_O = 'o';

// const QUEUE_DEALS = 'deals';
// const QUEUE_OFFERS = 'offers';
// const QUEUE_SEX = 'sex_digest';
// const QUEUE_AU = 'au_digest';

const CW_TIMEOUT = parseInt(process.env.CW_TIMEOUT, 0) || 5000;

const CW_RESPONSE_OK = 'Ok';
const CW_RESPONSE_NOT_REGISTERED = 'NotRegistered';
const CW_RESPONSE_BAD_FORMAT = 'BadFormat';

export const CW_RESPONSE_NO_FUNDS = 'InsufficientFunds';
export const CW_RESPONSE_USER_BUSY = 'UserIsBusy';
export const CW_RESPONSE_BATTLE_IS_NEAR = 'BattleIsNear';
export const CW_RESPONSE_WRONG_USER_ID = 'NoSuchUser';
export const CW_RESPONSE_NO_OFFERS = 'NoOffersFoundByPrice';
export const CW_RESPONSE_INVALID_CODE = 'InvalidCode';
export const CW_RESPONSE_INVALID_TOKEN = 'InvalidToken';

export const NOT_FOUND = 'Not found';
export const TIMED_OUT = 'Time out request to CW';

export default class CWExchange {

  constructor(config = {}) {

    const { appName, timeOut } = config;


    this.appName = appName || APP_NAME;
    this.timeOut = timeOut || CW_TIMEOUT;

    this.cache = new MessageCache();

    debug('Init', this.appName);

  }

  connect(connectionParams = {}) {

    const {
      apiUrl = API_URL,
      accessToken = ACCESS_TOKEN,
      amqpProtocol = AMQP_PROTOCOL || 'amqps',
    } = connectionParams;

    const manager = amqpConnect([`${amqpProtocol}://${this.appName}:${accessToken}@${apiUrl}`]);

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

        return channel.checkExchange(this.queueName(EX), '', { durable: true })
          .then(() => onCheckExchange.call(this, channel));

      },

    });

  }

  queueName(code) {
    return `${this.appName}_${code}`;
  }

  publish(msg, messageId = v4()) {
    const options = { messageId };
    const ex = this.queueName(EX);
    const queue = this.queueName(QUEUE_O);
    return this.channel.publish(ex, queue, Buffer.from(JSON.stringify(msg)), options);
  }

  sendMessage(message, domainKey) {

    const { action, userId } = message;
    const messageId = v4();

    if (isString(userId)) {
      // eslint-disable-next-line
      message.userId = parseInt(userId, 0);
    }

    debug('sendMessage', action, messageId);

    return new Promise((resolve, reject) => {

      const onTimeout = () => {
        debug('sendMessage onTimeout', messageId);
        this.cache.popById(action, messageId);
        reject(TIMED_OUT);
      };

      const timeOut = setTimeout(onTimeout, this.timeOut);
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
      action: Msg.ACTION_AUTH_SEND,
      payload: { userId },
    };

    debug('sendAuth to:', userId);

    return this.sendMessage(message, userId);

  }

  sendGrantToken(userId, authCode) {

    const message = {
      action: Msg.ACTION_GRANT_TOKEN,
      payload: { userId, authCode },
    };

    debug('sendGrantToken', message);

    return this.sendMessage(message, userId);

  }

  getInfo() {
    return this.sendMessage({ action: Msg.ACTION_GET_INFO });
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
      userId,
      action: Msg.ACTION_WTB,
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
      action: Msg.ACTION_REQUEST_STOCK,
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
      action: Msg.ACTION_PROFILE,
      token: tokenData.token,
    };

    return this.sendMessage(message, userId);

  }

}


/*
Private
 */


async function onCheckExchange(ch) {

  const { cache } = this;

  debug('CheckExchange success');

  await ch.bindQueue(this.queueName(QUEUE_O), this.queueName(EX));

  debug('Bind success', this.queueName(QUEUE_O));

  await ch.consume(this.queueName(QUEUE_I), message => {
    try {
      onConsumeResolve(message);
    } catch (err) {
      debug(`Error consuming ${this.queueName(QUEUE_I)}`, err.toString());
    }
  });

  onConsumeInit(this.queueName(QUEUE_I));

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

      case Msg.ACTION_GET_INFO: {
        processGetInfoResponse(result, payload);
        break;
      }

      case Msg.ACTION_WTB: {
        processWantToBuyResponse(result, payload);
        break;
      }

      case Msg.ACTION_GRANT_TOKEN:
      case Msg.ACTION_AUTH_SEND:
      case Msg.ACTION_REQUEST_STOCK:
      case Msg.ACTION_PROFILE: {

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

    const cached = cache.pop(Msg.ACTION_PROFILE);

    debug('processGetInfoResponse', Msg.ACTION_PROFILE, result);

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

    if (result === CW_RESPONSE_USER_BUSY) {
      const cached = cache.popByPredicate(Msg.ACTION_WTB, { userId });
      rejectCached(cached, result);
      return;
    }

    if (!itemCode) {
      debug('processWantToBuyResponse:', 'unknown itemName:', itemName);
      return;
    }

    const cached = cache.pop(Msg.ACTION_WTB, `${userId}_${itemCode}_${quantity}`);

    debug('processWantToBuyResponse', Msg.ACTION_WTB, result, itemName, quantity);

    switch (result) {

      case CW_RESPONSE_NO_FUNDS:
      case CW_RESPONSE_NO_OFFERS: {
        rejectCached(cached, result);
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

  // eslint-disable-next-line
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

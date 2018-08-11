import { connect as amqpConnect } from 'amqp-connection-manager';
import v4 from 'uuid/v4';
import { ACTION_PROFILE, MessageCache } from './MessageCache';
import database from '../db';

const { APP_NAME, ACCESS_TOKEN, API_URL, AMQP_PROTOCOL } = process.env;

const debug = require('debug')('laa:cwc:exchange');

const EX = queueName('ex');
const QUEUE_I = queueName('i');
const QUEUE_O = queueName('o');

const QUEUE_DEALS = queueName('deals');
const QUEUE_OFFERS = queueName('offers');
const QUEUE_SEX = queueName('sex_digest');
const QUEUE_AU = queueName('au_digest');

const TIMEOUT = 1000;
const CW_RESPONSE_OK = 'Ok';
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
        // `channel` here is a regular amqplib `ConfirmChannel`.
        debug('Got a channel');
        return channel.checkExchange(EX, '', { durable: true })
          .then(() => onCheckExchange(channel, this.cache))
          .then(() => {
            this.channel = channel;
          });
      },
    });

  }

  sendAuth(userId) {
    const msg = {
      action: 'createAuthCode',
      payload: { userId },
    };
    debug('sendAuth', msg);
    return this.publish(msg);
  }

  sendGrantToken(userId, authCode) {
    const msg = {
      action: 'grantToken',
      payload: { userId, authCode },
    };
    debug('sendGrantToken', msg);
    return this.publish(msg);
  }

  async requestProfile(userId) {

    const tokenData = await database.tokenByUserId(userId);
    const { cache } = this;

    if (!tokenData) {
      return Promise.reject(NOT_FOUND);
    }

    const message = {
      action: ACTION_PROFILE,
      token: tokenData.token,
    };

    return new Promise((resolve, reject) => {

      const timeOut = setTimeout(onTimeout, TIMEOUT);
      const options = {
        ...message,
        resolve,
        reject,
        timeOut,
      };
      const messageId = cache.push(ACTION_PROFILE, userId, options);

      debug('requestProfile', messageId);

      try {
        this.publish(message, messageId);
      } catch (err) {
        reject(err);
      }

      function onTimeout() {
        debug('requestProfile onTimeout', messageId);
        cache.popById(ACTION_PROFILE, messageId);
        reject(TIMED_OUT);
      }

    });

  }

  publish(msg, messageId = v4()) {
    const options = { messageId };
    return this.channel.publish(EX, QUEUE_O, Buffer.from(JSON.stringify(msg)), options);
  }

}


/*
Private
 */


async function onCheckExchange(ch, cache) {

  debug('CheckExchange success');

  await ch.bindQueue(QUEUE_O, EX)
    .then(() => {
      debug('Bind success', QUEUE_O);
      // sendAuth();
      // sendGrantToken();
    });

  await ch.consume(QUEUE_I, onConsumeResolve)
    .then(onConsumeInit(QUEUE_I));

  // await ch.consume(QUEUE_DEALS, onConsumeLog)
  //   .then(onConsumeInit(DEALS_QUEUE));
  //
  // await ch.consume(QUEUE_AU, onConsumeLog)
  //   .then(onConsumeInit(AU_QUEUE));
  //
  // await ch.consume(QUEUE_SEX, onConsumeLog)
  //   .then(onConsumeInit(SEX_QUEUE));
  //
  // await ch.consume(QUEUE_OFFERS, onConsumeLog)
  //   .then(onConsumeInit(OFFERS_QUEUE));

  return ch;

  function onConsumeResolve(msg) {

    const { content } = msg;
    // const { exchange, deliveryTag } = fields;
    const { action, result, payload } = JSON.parse(content.toString());

    debug('Consumed', action, result, payload);

    if (result === CW_RESPONSE_INVALID_TOKEN) {
      const { token } = payload;
      rejectCached(cache.popByPredicate(action, { token }), CW_RESPONSE_INVALID_TOKEN);
      ch.ack(msg);
      return;
    }

    switch (action) {

      case ACTION_PROFILE: {

        processProfileResponse(result, payload);
        break;

      }

      default: {
        debug('onConsumeResolve unknown action', action);
      }

    }

    // debug('Consumed fields', fields);
    // debug('Consumed properties', properties);

    ch.ack(msg);

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

  function processProfileResponse(result, payload) {

    const { userId } = payload;
    const cached = cache.pop(ACTION_PROFILE, userId);

    debug('onConsumeResolve', ACTION_PROFILE, result);

    if (result === CW_RESPONSE_OK) {
      resolveCached(cached, payload);
    } else {
      rejectCached(cached, payload);
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

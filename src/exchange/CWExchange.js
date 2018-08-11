import { connect as amqpConnect } from 'amqp-connection-manager';
import v4 from 'uuid/v4';
import { ACTION_PROFILE, MessageCache } from './MessageCache';
import database from '../db';

const { APP_NAME, ACCESS_TOKEN, API_URL } = process.env;

const debug = require('debug')('laa:cwc:exchange');

const EX = queueName('ex');
const QUEUE_I = queueName('i');
const QUEUE_O = queueName('o');

const DEALS_QUEUE = queueName('deals');
const AU_QUEUE = queueName('au_digest');
const SEX_QUEUE = queueName('sex_digest');
const OFFERS_QUEUE = queueName('offers');

const CW_RESPONSE_OK = 'Ok';
const CW_RESPONSE_INVALID_TOKEN = 'InvalidToken';

const NOT_FOUND = 'Not found';

export default class CWExchange {

  constructor() {

    // const { name, methods = {} } = config;

    debug('Init', API_URL, APP_NAME);
    this.cache = new MessageCache();

  }

  connect() {

    const manager = amqpConnect([`amqps://${APP_NAME}:${ACCESS_TOKEN}@${API_URL}`]);

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

    // if (!tokenData) {
    //   return Promise.reject(NOT_FOUND);
    // }

    const msg = {
      action: ACTION_PROFILE,
      token: tokenData.token,
    };

    return new Promise((resolve, reject) => {

      const messageId = this.cache.push(ACTION_PROFILE, userId, { resolve, reject });

      debug('sendGrantToken', messageId);

      try {
        this.publish(msg, messageId);
      } catch (err) {
        reject(err);
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

  // await ch.consume(DEALS_QUEUE, onConsumeLog)
  //   .then(onConsumeInit(DEALS_QUEUE));
  //
  // await ch.consume(AU_QUEUE, onConsumeLog)
  //   .then(onConsumeInit(AU_QUEUE));
  //
  // await ch.consume(SEX_QUEUE, onConsumeLog)
  //   .then(onConsumeInit(SEX_QUEUE));
  //
  // await ch.consume(OFFERS_QUEUE, onConsumeLog)
  //   .then(onConsumeInit(OFFERS_QUEUE));

  return ch;

  function onConsumeResolve(msg) {

    const { content } = msg;
    // const { exchange, deliveryTag } = fields;
    const { action, result, payload } = JSON.parse(content.toString());

    debug('Consumed', action, result, payload);

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

  function processProfileResponse(result, payload) {

    if (result === CW_RESPONSE_INVALID_TOKEN) {
      return;
    }

    const { userId } = payload;
    const cached = cache.pop(ACTION_PROFILE, userId);

    cached.forEach(({ resolve, reject }) => {
      if (result === CW_RESPONSE_OK) {
        resolve(payload);
      } else {
        reject(payload);
      }
    });

    debug('onConsumeResolve', ACTION_PROFILE, cached.length, 'messages');

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

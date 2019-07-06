'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TIMED_OUT = exports.NOT_FOUND = exports.NOT_AUTHORIZED = exports.CW_RESPONSE_INVALID_TOKEN = exports.CW_RESPONSE_INVALID_CODE = exports.CW_RESPONSE_NO_OFFERS = exports.CW_RESPONSE_WRONG_USER_ID = exports.CW_RESPONSE_BATTLE_IS_NEAR = exports.CW_RESPONSE_USER_BUSY = exports.CW_RESPONSE_NO_FUNDS = exports.QUEUE_DUELS = exports.QUEUE_YELLOW_PAGES = exports.QUEUE_AU = exports.QUEUE_SEX = exports.QUEUE_OFFERS = exports.QUEUE_DEALS = undefined;
exports.allItemsByName = allItemsByName;

var _amqpConnectionManager = require('amqp-connection-manager');

var _isFunction = require('lodash/isFunction');

var _isFunction2 = _interopRequireDefault(_isFunction);

var _map = require('lodash/map');

var _map2 = _interopRequireDefault(_map);

var _MessageCache = require('./MessageCache');

var Msg = _interopRequireWildcard(_MessageCache);

var _itemsByName = require('../db/itemsByName');

var _itemsByName2 = _interopRequireDefault(_itemsByName);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import v4 from 'uuid/v4';
const {
  CW_APP_NAME, CW_APP_PASSWORD, API_URL, AMQP_PROTOCOL
} = process.env;

const debug = require('debug')('laa:cwc:exchange');

const EX = 'ex';
const QUEUE_I = 'i';
const QUEUE_O = 'o';

const QUEUE_DEALS = exports.QUEUE_DEALS = 'deals';
const QUEUE_OFFERS = exports.QUEUE_OFFERS = 'offers';
const QUEUE_SEX = exports.QUEUE_SEX = 'sex_digest';
const QUEUE_AU = exports.QUEUE_AU = 'au_digest';
const QUEUE_YELLOW_PAGES = exports.QUEUE_YELLOW_PAGES = 'yellow_pages';
const QUEUE_DUELS = exports.QUEUE_DUELS = 'duels';

const CW_TIMEOUT = parseInt(process.env.CW_TIMEOUT, 0) || 5000;

const CW_RESPONSE_OK = 'Ok';
const CW_RESPONSE_NOT_REGISTERED = 'NotRegistered';
const CW_RESPONSE_BAD_FORMAT = 'BadFormat';

const CW_RESPONSE_NO_FUNDS = exports.CW_RESPONSE_NO_FUNDS = 'InsufficientFunds';
const CW_RESPONSE_USER_BUSY = exports.CW_RESPONSE_USER_BUSY = 'UserIsBusy';
const CW_RESPONSE_BATTLE_IS_NEAR = exports.CW_RESPONSE_BATTLE_IS_NEAR = 'BattleIsNear';
const CW_RESPONSE_WRONG_USER_ID = exports.CW_RESPONSE_WRONG_USER_ID = 'NoSuchUser';
const CW_RESPONSE_NO_OFFERS = exports.CW_RESPONSE_NO_OFFERS = 'NoOffersFoundByPrice';
const CW_RESPONSE_INVALID_CODE = exports.CW_RESPONSE_INVALID_CODE = 'InvalidCode';
const CW_RESPONSE_INVALID_TOKEN = exports.CW_RESPONSE_INVALID_TOKEN = 'InvalidToken';

const NOT_AUTHORIZED = exports.NOT_AUTHORIZED = 'Not authorized';
const NOT_FOUND = exports.NOT_FOUND = 'Not found';
const TIMED_OUT = exports.TIMED_OUT = 'Time out request to CW';

class CWExchange {

  constructor(config = {}) {

    const { appName, timeOut, fanouts = [] } = config;

    this.noAck = config.noAck;
    this.appName = appName || CW_APP_NAME;
    this.timeOut = timeOut || CW_TIMEOUT;
    this.fanouts = fanouts;
    this.bindIO = config.bindIO;
    this.nextMessageId = 0;
    this.ex = this.queueName(EX);
    this.queueO = this.queueName(QUEUE_O);

    this.cache = new Msg.default();

    debug('Init', this.appName);
  }

  connect(connectionParams = {}) {

    const {
      apiUrl = API_URL,
      accessToken = CW_APP_PASSWORD,
      amqpProtocol = AMQP_PROTOCOL || 'amqps'
    } = connectionParams;

    const manager = (0, _amqpConnectionManager.connect)([`${amqpProtocol}://${this.appName}:${accessToken}@${apiUrl}`]);

    manager.on('connect', () => {
      debug('Manager connected');
    });

    manager.on('disconnect', params => {
      debug('Manager disconnected', params.err.stack);
    });

    this.onceConnected = new Promise(resolve => {

      manager.createChannel({
        json: true
      }).addSetup(channel => {

        debug('Got a channel wrapper');

        this.channel = channel;

        return channel.checkExchange(this.queueName(EX), '', { durable: true }).then(() => onCheckExchange.call(this, channel)).then(resolve);
      });
    });

    return this.onceConnected;
  }

  newId() {
    this.nextMessageId += 1;
    return this.nextMessageId.toString();
  }

  /**
   * Returns CW queue name for the API key
   * @param code
   * @returns {string}
   */

  queueName(code) {
    return `${this.appName}_${code}`;
  }

  /**
   * Push a message to the outbound queue
   * @param msg
   * @param messageId
   * @returns {Promise<any>}
   */

  publish(msg) {
    return this.channel.publish(this.ex, this.queueO, Buffer.from(JSON.stringify(msg)));
  }

  /**
   * Wraps a message into a keyed cache entry to synchronize request and response
   * @param message
   * @param domainKey
   * @returns {Promise<any>}
   */

  sendMessage(message, domainKey) {

    const { action } = message;
    const messageId = this.newId();

    debug('sendMessage', action, messageId);

    return new Promise(async (resolve, reject) => {

      const onTimeout = () => {
        debug('sendMessage onTimeout', messageId);
        this.cache.popByMessageId(action, messageId);
        reject(TIMED_OUT);
      };

      const timeOut = setTimeout(onTimeout, this.timeOut);
      const options = {
        resolve, reject, timeOut, messageId
      };
      Object.assign(options, message);

      this.cache.push(action, domainKey, options);

      try {
        await this.publish(message);
      } catch (err) {
        clearTimeout(timeOut);
        this.cache.popByMessageId(action, messageId);
        reject(err);
      }
    });
  }

  /**
    CW API protocol
    */

  authAdditionalOperation(userId, operation, token) {
    const message = {
      action: Msg.ACTION_AUTH_ADDITIONAL,
      token,
      payload: { operation }
    };

    debug('authAdditional:', operation, token);

    return this.sendMessage(message, userId);
  }

  sendAuth(userId) {

    const message = {
      action: Msg.ACTION_AUTH_SEND,
      payload: { userId }
    };

    debug('sendAuth to:', userId);

    return this.sendMessage(message, userId);
  }

  sendGrantToken(userId, authCode) {

    const message = {
      action: Msg.ACTION_GRANT_TOKEN,
      payload: { userId, authCode }
    };

    debug('sendGrantToken', message);

    return this.sendMessage(message, userId);
  }

  grantAdditionalOperation(userId, requestId, authCode, token) {

    const message = {
      action: Msg.ACTION_GRANT_ADDITIONAL,
      token,
      payload: { requestId, authCode }
    };

    debug('grantAdditionalOperation', message);

    return this.sendMessage(message, userId);
  }

  getInfo() {
    return this.sendMessage({ action: Msg.ACTION_GET_INFO });
  }

  guildInfo(userId, token) {

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_GUILD_INFO,
      token
    };

    return this.sendMessage(message, userId);
  }

  craftBook(userId, token) {

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_CRAFT_BOOK,
      token
    };

    return this.sendMessage(message, userId);
  }

  gearInfo(userId, token) {

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_GEAR_INFO,
      token
    };

    return this.sendMessage(message, userId);
  }

  async wantToBuy(userId, params, token) {

    const {
      itemCode, quantity, price, exactPrice = true
    } = params;

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_WTB,
      userId,
      token,
      payload: {
        itemCode, quantity, price, exactPrice
      }
    };

    const dealKey = `${userId}_${itemCode}_${quantity}`;

    return this.sendMessage(message, dealKey);
  }

  wtbFast(userId, params, token) {

    return this.publish({
      action: Msg.ACTION_WTB,
      userId,
      token,
      payload: params
    });
  }

  async requestStock(userId, token) {

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_REQUEST_STOCK,
      token
    };

    return this.sendMessage(message, userId);
  }

  async requestProfile(userId, token) {

    if (!token) {
      return Promise.reject(NOT_AUTHORIZED);
    }

    const message = {
      action: Msg.ACTION_PROFILE,
      token
    };

    return this.sendMessage(message, userId);
  }

}

exports.default = CWExchange;
function allItemsByName() {
  return _itemsByName2.default;
}

/*
Private
 */

async function onCheckExchange(ch) {

  const { cache, bindIO } = this;

  debug('CheckExchange success');

  if (bindIO) {

    await ch.bindQueue(this.queueName(QUEUE_O), this.queueName(EX));

    debug('Bind success', this.queueName(QUEUE_O));

    await ch.consume(this.queueName(QUEUE_I), async message => {
      try {
        await onConsumeResolve(message);
      } catch (err) {
        debug(`Error consuming ${this.queueName(QUEUE_I)}`, err.toString());
      }
    });
  }

  onConsumeInit(this.queueName(QUEUE_I));

  const fanoutsInit = (0, _map2.default)(this.fanouts, async (fn, name) => {

    const queueName = this.queueName((0, _isFunction2.default)(fn) ? name : fn);
    const fnAck = this.noAck ? fn : msg => fn(msg, () => ch.ack(msg));
    const listener = (0, _isFunction2.default)(fn) ? fnAck : onConsumeLog;

    await ch.consume(queueName, listener, { noAck: !!this.noAck });
    onConsumeInit(name);
  });

  await Promise.all(fanoutsInit);

  return ch;

  async function onConsumeResolve(msg) {

    const { content } = msg;
    const json = JSON.parse(content.toString());
    const { action, result, payload } = json;
    const { userId } = payload || {};

    debug('onConsumeResolve', action, result, json);

    const exceptions = checkExceptions();
    const responseCode = exceptions || action;

    switch (responseCode) {

      case CW_RESPONSE_INVALID_TOKEN:
        {
          processResponseException(action, result, payload);
          break;
        }

      case Msg.ACTION_GET_INFO:
        {
          processGetInfoResponse(responseCode, result, payload);
          break;
        }

      case Msg.ACTION_WTB:
        {
          processWantToBuyResponse(result, payload);
          break;
        }

      case Msg.ACTION_AUTH_ADDITIONAL:
        {
          processAuthAdditionalResponse(responseCode, json.uuid, payload);
          break;
        }

      case Msg.ACTION_GEAR_INFO:
      case Msg.ACTION_CRAFT_BOOK:
      case Msg.ACTION_GUILD_INFO:
      case Msg.ACTION_GRANT_ADDITIONAL:
      case Msg.ACTION_GRANT_TOKEN:
      case Msg.ACTION_AUTH_SEND:
      case Msg.ACTION_REQUEST_STOCK:
      case Msg.ACTION_PROFILE:
        {

          processProfileResponse(responseCode, result, payload);
          break;
        }

      default:
        {
          debug('onConsumeResolve default', action);
        }

    }

    // const { exchange, deliveryTag } = fields;
    // debug('Consumed fields', fields);
    // debug('Consumed properties', properties);

    ch.ack(msg);

    function checkExceptions() {

      switch (result) {

        case CW_RESPONSE_INVALID_CODE:
          {
            rejectCached(cache.pop(action, userId), CW_RESPONSE_INVALID_CODE);
            break;
          }

        case CW_RESPONSE_USER_BUSY:
        case CW_RESPONSE_BATTLE_IS_NEAR:
          {
            rejectCached(cache.popByPredicate(action, { userId }), result);
            break;
          }

        case CW_RESPONSE_BAD_FORMAT:
          {
            debug('checkExceptions', result);
            break;
          }

        case CW_RESPONSE_WRONG_USER_ID:
          {
            rejectCached(cache.popByPredicate(action, {}), result);
            break;
          }

        case CW_RESPONSE_INVALID_TOKEN:
          {
            const { token } = payload;
            rejectCached(cache.popByPredicate(action, { token }), result);
            break;
          }

        case CW_RESPONSE_NOT_REGISTERED:
          {
            resolveCached(cache.popByPredicate(action, {}), { status: CW_RESPONSE_NOT_REGISTERED });
            break;
          }

        default:
          {
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

  function processGetInfoResponse(responseCode, result, payload) {

    const cached = cache.pop(responseCode);

    debug('processGetInfoResponse', responseCode, result);

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

  function processAuthAdditionalResponse(action, uuid, payload) {

    const { userId } = payload;
    const cached = cache.pop(action, userId);

    debug('processProfileResponse', action, userId, uuid);

    if (uuid) {
      resolveCached(cached, { uuid, userId });
    } else {
      rejectCached(cached, payload);
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
    const itemCode = _itemsByName2.default[itemName];

    if (!itemCode) {
      debug('processWantToBuyResponse:', 'unknown itemName:', itemName);
      return;
    }

    const cached = cache.pop(Msg.ACTION_WTB, `${userId}_${itemCode}_${quantity}`);

    debug('processWantToBuyResponse', Msg.ACTION_WTB, result, itemName, quantity);

    switch (result) {

      case CW_RESPONSE_NO_FUNDS:
      case CW_RESPONSE_NO_OFFERS:
        {
          rejectCached(cached, result);
          break;
        }

      case CW_RESPONSE_OK:
        {
          resolveCached(cached, payload);
          break;
        }

      default:
        {
          rejectCached(cached, payload);
        }

    }
  }

  // eslint-disable-next-line
  function onConsumeLog(msg) {
    const { fields, properties, content } = msg;
    const { exchange, deliveryTag } = fields;
    const ts = new Date(properties.timestamp * 1000);
    debug('Consumed', exchange, deliveryTag, ts, content.toString());
    // debug('Consumed fields', fields);
    // debug('Consumed properties', properties);
    ch.ack(msg);
  }

  function onConsumeInit(queueName) {
    return () => debug('Consume init', queueName);
  }
}
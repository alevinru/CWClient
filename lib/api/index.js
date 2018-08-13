'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _koaRouter = require('koa-router');

var _koaRouter2 = _interopRequireDefault(_koaRouter);

var _exchange = require('../exchange');

var _exchange2 = _interopRequireDefault(_exchange);

var _CWExchange = require('../exchange/CWExchange');

var CWErrors = _interopRequireWildcard(_CWExchange);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = require('debug')('laa:cwc:api');

const router = new _koaRouter2.default();

exports.default = router;


router.post('/auth/:userId', async ctx => {

  const { params } = ctx;
  const { userId } = params;

  debug('auth', userId);

  try {
    ctx.body = await _exchange2.default.sendAuth(parseInt(userId, 0));
  } catch (err) {
    exceptionHandler(ctx)(err);
  }
});

router.post('/token/:userId/:authCode', async ctx => {

  const { params } = ctx;
  const { userId, authCode } = params;

  debug('token', userId, authCode);

  try {
    ctx.body = await _exchange2.default.sendGrantToken(parseInt(userId, 0), authCode);
  } catch (e) {
    handleException(ctx, e);
  }
});

router.get('/profile/:userId', async ctx => {

  const { userId } = ctx.params;

  debug('GET /profile', userId);

  try {
    ctx.body = await _exchange2.default.requestProfile(parseInt(userId, 0));
  } catch (err) {
    handleException(ctx, err);
  }
});

router.get('/stock/:userId', async ctx => {

  const { userId } = ctx.params;

  debug('GET /stock', userId);

  try {
    ctx.body = await _exchange2.default.requestStock(parseInt(userId, 0));
  } catch (err) {
    handleException(ctx, err);
  }
});

router.post('/buy/:itemCode', async ctx => {

  const { params: { itemCode }, query: { userId, quantity, price } } = ctx;

  debug('POST /buy', userId, `${itemCode}_${quantity}_${price}`);

  try {
    ctx.body = await _exchange2.default.wantToBy(parseInt(userId, 0), { itemCode, quantity, price });
  } catch (err) {
    handleException(ctx, err);
  }
});

router.get('/info', async ctx => {

  debug('GET /info');

  try {
    ctx.body = await _exchange2.default.getInfo();
  } catch (err) {
    handleException(ctx, err);
  }
});

function exceptionHandler(ctx) {
  return err => handleException(ctx, err);
}

function handleException(ctx, err) {

  const { response } = ctx;

  debug('handleException', err);

  ctx.body = err;

  switch (err) {

    case CWErrors.CW_RESPONSE_USER_BUSY:
    case CWErrors.CW_RESPONSE_BATTLE_IS_NEAR:
      {
        response.status = 502;
        break;
      }

    case CWErrors.CW_RESPONSE_NO_FUNDS:
    case CWErrors.CW_RESPONSE_WRONG_USER_ID:
    case CWErrors.NOT_FOUND:
    case CWErrors.CW_RESPONSE_NO_OFFERS:
      {
        response.status = 404;
        break;
      }

    case CWErrors.NOT_AUTHORIZED:
    case CWErrors.CW_RESPONSE_INVALID_TOKEN:
    case CWErrors.CW_RESPONSE_INVALID_CODE:
      {
        response.status = 401;
        break;
      }

    case CWErrors.TIMED_OUT:
      {
        response.status = 504;
        break;
      }

    default:
      {
        throw new Error(err);
      }

  }
}
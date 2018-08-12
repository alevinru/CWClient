import Router from 'koa-router';
import exchange from '../exchange';
import * as CWErrors from '../exchange/CWExchange';

const debug = require('debug')('laa:cwc:api');

const router = new Router();

export default router;

router.post('/auth/:userId', async ctx => {

  const { params } = ctx;
  const { userId } = params;

  debug('auth', userId);

  ctx.body = await exchange.sendAuth(parseInt(userId, 0))
    .catch(exceptionHandler(ctx));

});

router.post('/token/:userId/:authCode', async ctx => {

  const { params } = ctx;
  const { userId, authCode } = params;

  debug('token', userId, authCode);

  try {
    ctx.body = await exchange.sendGrantToken(parseInt(userId, 0), authCode);
  } catch (e) {
    handleException(ctx, e);
  }

});

router.get('/profile/:userId', async ctx => {

  const { userId } = ctx.params;

  debug('GET /profile', userId);

  try {
    ctx.body = await exchange.requestProfile(parseInt(userId, 0));
  } catch (err) {
    handleException(ctx, err);
  }

});

router.get('/stock/:userId', async ctx => {

  const { userId } = ctx.params;

  debug('GET /stock', userId);

  try {
    ctx.body = await exchange.requestStock(parseInt(userId, 0));
  } catch (err) {
    handleException(ctx, err);
  }

});

router.post('/buy/:itemCode', async ctx => {

  const { params: { itemCode }, query: { userId, quantity, price } } = ctx;

  debug('POST /buy', userId, `${itemCode}_${quantity}_${price}`);

  try {
    ctx.body = await exchange.wantToBy(parseInt(userId, 0), { itemCode, quantity, price });
  } catch (err) {
    handleException(ctx, err);
  }

});

router.get('/info', async ctx => {

  debug('GET /info');

  try {
    ctx.body = await exchange.getInfo();
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

  switch (err) {

    case CWErrors.NOT_FOUND:
    case CWErrors.CW_RESPONSE_NO_OFFERS: {
      response.status = 404;
      break;
    }

    case CWErrors.CW_RESPONSE_INVALID_CODE: {
      response.status = 400;
      ctx.body = err;
      break;
    }

    case CWErrors.TIMED_OUT: {
      response.status = 504;
      break;
    }

    case CWErrors.CW_RESPONSE_INVALID_TOKEN: {
      response.status = 401;
      ctx.body = err;
      break;
    }

    default: {
      throw new Error(err);
    }

  }


}

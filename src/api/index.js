import Router from 'koa-router';
import exchange from '../exchange';
import { NOT_FOUND, TIMED_OUT, CW_RESPONSE_INVALID_TOKEN } from '../exchange/CWExchange';

const debug = require('debug')('laa:cwc:api');

const router = new Router();

export default router;

router.post('/auth/:userId', ctx => {

  const { params } = ctx;
  const { userId } = params;

  debug('auth', userId);

  ctx.body = exchange.sendAuth(parseInt(userId, 0));

});

router.post('/token/:userId', ctx => {

  const { params, query: { authCode } } = ctx;
  const { userId } = params;

  debug('token', userId, authCode);

  ctx.body = exchange.sendGrantToken(parseInt(userId, 0), authCode);

});

router.get('/profile/:userId', async ctx => {

  const { userId } = ctx.params;

  debug('profile', userId);

  try {
    ctx.body = await exchange.requestProfile(parseInt(userId, 0));
  } catch (err) {

    const { response } = ctx;

    if (err === NOT_FOUND) {
      response.status = 404;
    } else if (err === TIMED_OUT) {
      response.status = 504;
    } else if (err === CW_RESPONSE_INVALID_TOKEN) {
      response.status = 404;
      ctx.body = CW_RESPONSE_INVALID_TOKEN;
    } else {
      throw new Error(err);
    }

  }

});

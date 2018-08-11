import Router from 'koa-router';
import exchange from '../exchange';

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

  ctx.body = await exchange.requestProfile(parseInt(userId, 0));

});

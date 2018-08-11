import Koa from 'koa';
import bodyParser from 'koa-body';
import api from './api';

const debug = require('debug')('laa:chw:server');

const { PORT } = process.env;
const app = new Koa();

// export default app;

api.prefix('/api');

debug('starting on port', PORT);

app
  .use(bodyParser())
  .use(api.routes())
  .use(api.allowedMethods())
  .listen(PORT);

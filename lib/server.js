'use strict';

var _koa = require('koa');

var _koa2 = _interopRequireDefault(_koa);

var _koaBody = require('koa-body');

var _koaBody2 = _interopRequireDefault(_koaBody);

var _api = require('./api');

var _api2 = _interopRequireDefault(_api);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = require('debug')('laa:cwc:server');

const { PORT } = process.env;
const app = new _koa2.default();

// export default app;

_api2.default.prefix('/api');

debug('starting on port', PORT);

app.use((0, _koaBody2.default)()).use(_api2.default.routes()).use(_api2.default.allowedMethods()).listen(PORT);
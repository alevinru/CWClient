'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _CWExchange = require('./CWExchange');

var _CWExchange2 = _interopRequireDefault(_CWExchange);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const exchange = new _CWExchange2.default({ bindIO: true });

exports.default = exchange;


exchange.connect();
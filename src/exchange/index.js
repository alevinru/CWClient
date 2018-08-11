import CWExchange from './CWExchange';

const debug = require('debug')('laa:cwc:exchange');

const exchange = new CWExchange();

export default exchange;

exchange.connect()
  .catch(e => {
    debug('Error connecting', e);
  });

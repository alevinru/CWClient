import redis from 'redis';
import { promisify } from 'util';

export const client = redis.createClient();

export const hgetAsync = promisify(client.hget).bind(client);
export const hsetAsync = promisify(client.hset).bind(client);

const debug = require('debug')('laa:cwc:redis');

client.on('error', err => {
  debug('Error', err);
});

client.on('connect', () => {
  debug('Redis connected');
});

import { hgetAsync, hsetAsync } from './redis';

const { USER_ID, USER_TOKEN } = process.env;

const REDIS_TOKENS_HASH = 'tokens';

export default class Database {

  constructor() {

    if (!USER_ID) {
      return;
    }

    this.tokens = {
      [USER_ID]: { token: USER_TOKEN },
    };

  }

  setToken(userId, token) {

    if (USER_ID) {
      this.tokens[userId.toString()] = token;
      return Promise.resolve();
    }

    return hsetAsync(REDIS_TOKENS_HASH, userId, JSON.stringify(token));

  }

  tokenByUserId(userId) {

    if (USER_ID) {
      const res = this.tokens[userId.toString()];
      return Promise.resolve(res);
    }

    return hgetAsync(REDIS_TOKENS_HASH, userId)
      .then(res => JSON.parse(res));

  }

}

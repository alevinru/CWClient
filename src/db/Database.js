const { USER_ID, USER_TOKEN } = process.env;

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

    this.tokens[userId.toString()] = token;
    return Promise.resolve();

  }

  tokenByUserId(userId) {

    const res = this.tokens[userId.toString()];
    return Promise.resolve(res);

  }

}

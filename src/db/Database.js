const { USER_ID, USER_TOKEN } = process.env;

export default class Database {

  constructor() {

    this.tokens = {
      [USER_ID]: { token: USER_TOKEN },
    };

  }

  tokenByUserId(userId) {

    const res = this.tokens[userId.toString()];

    return Promise.resolve(res);

  }

}

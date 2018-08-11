export default class Database {

  constructor() {

    this.tokens = {
      },
    };

  }

  tokenByUserId(userId) {

    const res = this.tokens[userId.toString()];

    return Promise.resolve(res);

  }

}

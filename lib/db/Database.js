"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const { USER_ID, USER_TOKEN } = process.env;

class Database {

  constructor() {

    if (!USER_ID) {
      return;
    }

    this.tokens = {
      [USER_ID]: { token: USER_TOKEN }
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
exports.default = Database;
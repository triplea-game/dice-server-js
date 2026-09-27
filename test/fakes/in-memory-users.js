// Stands in for DbHandler. test/contract/users-contract.js holds it to the
// same behavior as the real Postgres-backed store: exact-match uniqueness on
// insert, case-insensitive lookup and removal, a varchar(254) column.
const MAX_EMAIL_LENGTH = 254;

class InMemoryUsers {
  constructor(emails = []) {
    this.emails = new Set(emails);
    this.closed = false;
  }

  assertOpen() {
    if (this.closed) throw new Error('users store is closed');
  }

  async setupDb() {
    this.assertOpen();
  }

  async ping() {
    this.assertOpen();
  }

  async addUser(email) {
    this.assertOpen();
    if (email.length > MAX_EMAIL_LENGTH) throw new Error(`value too long for type character varying(${MAX_EMAIL_LENGTH})`);
    this.emails.add(email);
  }

  async removeUser(email) {
    this.assertOpen();
    const matches = this.matching(email);
    matches.forEach((match) => this.emails.delete(match));
    return matches.length;
  }

  async checkMail(email) {
    this.assertOpen();
    const [match] = this.matching(email);
    return match === undefined ? null : { email: match };
  }

  matching(email) {
    return [...this.emails].filter((stored) => stored.toLowerCase() === email.toLowerCase());
  }

  async close() {
    this.closed = true;
  }
}

module.exports = InMemoryUsers;

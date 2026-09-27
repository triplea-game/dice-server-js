// Stands in for DbHandler. test/contract/users-contract.js holds it to the
// same behavior as the real Postgres-backed store: exact-match uniqueness on
// insert, case-insensitive lookup and removal, a varchar(254) column.
const MAX_EMAIL_LENGTH = 254;

class InMemoryUsers {
  constructor(emails = []) {
    this.emails = new Set(emails);
  }

  // eslint-disable-next-line class-methods-use-this
  async setupDb() {
    // Nothing to create in memory.
  }

  // eslint-disable-next-line class-methods-use-this
  async ping() {
    // Always reachable.
  }

  async addUser(email) {
    if (email.length > MAX_EMAIL_LENGTH) throw new Error(`value too long for type character varying(${MAX_EMAIL_LENGTH})`);
    if (this.emails.has(email)) throw new Error(`duplicate key: ${email}`);
    this.emails.add(email);
  }

  async removeUser(email) {
    const matches = this.matching(email);
    matches.forEach((match) => this.emails.delete(match));
    return matches.length;
  }

  async checkMail(email) {
    const [match] = this.matching(email);
    return match === undefined ? null : { email: match };
  }

  matching(email) {
    return [...this.emails].filter((stored) => stored.toLowerCase() === email.toLowerCase());
  }
}

module.exports = InMemoryUsers;

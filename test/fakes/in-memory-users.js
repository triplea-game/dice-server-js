// Stands in for DbHandler. test/contract/users-contract.js holds it to the
// same behavior as the real Postgres-backed store.
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
    if (this.emails.has(email)) throw new Error(`duplicate key: ${email}`);
    this.emails.add(email);
  }

  async removeUser(email) {
    return this.emails.delete(email) ? 1 : 0;
  }

  async checkMail(email) {
    return this.emails.has(email) ? { email } : null;
  }
}

module.exports = InMemoryUsers;

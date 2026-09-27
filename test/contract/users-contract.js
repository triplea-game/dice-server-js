/* eslint-disable jest/no-export -- a shared suite, run from each store's test file */
// The behavior the API and EmailManager assume of their users store. Run
// against every implementation: DbHandler on real Postgres (db-handler.test.js)
// and the in-memory fake the shell tests use (test/shell/in-memory-users.test.js).
// `makeUsers` may return a shared store, so every test uses its own unique email.
const describeUsersContract = (name, makeUsers) => {
  const uniqueEmail = () => `contract-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const emailOfLength = (length) => {
    const unique = uniqueEmail();
    return `${'a'.repeat(length - unique.length)}${unique}`;
  };

  describe(`${name} (users store contract)`, () => {
    it('reports an email that was never added as not registered', async () => {
      const users = await makeUsers();

      expect(await users.checkMail(uniqueEmail())).toBeNull();
    });

    it('reports an added email as registered', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();

      await users.addUser(email);

      expect(await users.checkMail(email)).toBeTruthy();
    });

    it('keeps one row when the same email is added twice', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();
      await users.addUser(email);

      await users.addUser(email);

      expect(await users.removeUser(email)).toBe(1);
    });

    it('returns 1 when removing a registered email, and forgets it', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();
      await users.addUser(email);

      const removed = await users.removeUser(email);

      expect(removed).toBe(1);
      expect(await users.checkMail(email)).toBeNull();
    });

    it('finds a registered email whatever the casing of the lookup', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();
      await users.addUser(email.toUpperCase());

      expect(await users.checkMail(email)).toEqual({ email: email.toUpperCase() });
    });

    it('removes a registered email whatever the casing of the request', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();
      await users.addUser(email.toUpperCase());

      expect(await users.removeUser(email)).toBe(1);
      expect(await users.checkMail(email)).toBeNull();
    });

    it('keeps rows that differ only in casing apart, so existing mixed-case rows stay insertable', async () => {
      const users = await makeUsers();
      const email = uniqueEmail();
      await users.addUser(email);

      await users.addUser(email.toUpperCase());

      expect(await users.removeUser(email)).toBe(2);
    });

    it('accepts an email of 254 characters', async () => {
      const users = await makeUsers();
      const email = emailOfLength(254);

      await users.addUser(email);

      expect(await users.checkMail(email)).toEqual({ email });
      await users.removeUser(email);
    });

    it('rejects an email of 255 characters', async () => {
      const users = await makeUsers();
      const email = emailOfLength(255);

      await expect(users.addUser(email)).rejects.toThrow();
    });

    it('returns 0 when removing an email that is not registered', async () => {
      const users = await makeUsers();

      expect(await users.removeUser(uniqueEmail())).toBe(0);
    });

    it('answers a ping when its storage is reachable', async () => {
      const users = await makeUsers();

      await expect(users.ping()).resolves.not.toThrow();
    });

    it('can set up its storage more than once', async () => {
      const users = await makeUsers();

      await users.setupDb();
      await users.setupDb();

      expect(await users.checkMail(uniqueEmail())).toBeNull();
    });
  });
};

module.exports = { describeUsersContract };

jest.enableAutomock();
jest.unmock('../../src/api/db-handler');

const pg = require('pg-promise');

const mockedPg = jest.fn();
pg.mockReturnValue(mockedPg);
const DbHandler = require('../../src/api/db-handler');

const dbObject = {
  none: jest.fn(),
  result: jest.fn(),
  oneOrNone: jest.fn(),
};

describe('The DB-Handler', () => {
  beforeAll(() => {
    mockedPg.mockReturnValue(dbObject);
    dbObject.none.mockReturnValue(Promise.resolve(true));
  });

  it('should create a database when initialized', () => {
    const handler = new DbHandler({
      username: 'user',
      password: 'secret',
      host: '[::1]',
      port: '1337',
      database: 'someDb',
    });

    handler.setupDb();

    expect(mockedPg).toMatchSnapshot();
    expect(dbObject.none).toMatchSnapshot();
  });

  it('should log an error if something goes wrong', async () => {
    global.console.error = jest.fn();
    dbObject.none = jest.fn();
    const testError = new Error('ERROR MESSAGE');
    dbObject.none.mockReturnValue(Promise.reject(testError));
    await new DbHandler({}).setupDb();

    expect(global.console.error).toHaveBeenCalledTimes(2);
    expect(global.console.error).toHaveBeenLastCalledWith(testError);
    global.console.error.mockRestore();
  });

  it('should execute the correct call to the database on addUser', () => {
    const handler = new DbHandler({});
    handler.addUser('Test Email');
    expect(dbObject.none).toMatchSnapshot();
  });

  it('should execute the correct call to the database on removeUser', () => {
    const handler = new DbHandler({});
    handler.removeUser('Test Email');
    expect(dbObject.result).toMatchSnapshot();
  });

  it('should execute the correct call to the database on checkMail', () => {
    const handler = new DbHandler({});
    handler.checkMail('Test Email');
    expect(dbObject.oneOrNone).toMatchSnapshot();
  });
});

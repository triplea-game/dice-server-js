const pgPromise = jest.genMockFromModule('pg-promise');

module.exports = jest.fn(pgPromise);

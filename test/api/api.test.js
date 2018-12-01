const mockNconf = {
  get: jest.fn(string => string),
};
const mockRollDice = jest.fn();
const mockValidator = jest.fn();
const mockEmailManager = jest.fn();
const mockDbHandler = jest.fn();
mockDbHandler.prototype.setupDb = jest.fn();


jest.mock('nconf', () => mockNconf);
jest.mock('../../src/api/dice-roller', () => ({
  roll: mockRollDice,
}));
jest.mock('../../src/api/validator', () => mockValidator);
jest.mock('../../src/api/email-manager.js', () => mockEmailManager);
jest.mock('../../src/api/db-handler', () => mockDbHandler);

const api = require('../../src/api/api');

const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  use: jest.fn(),
};

describe('The API', () => {
  it('should setup the routes correctly', () => {
    const router = api(mockRouter, {
      name: 'Dummy DB',
    });

    expect(router).toBe(mockRouter);

    expect(mockNconf.get).toMatchSnapshot();
    expect(mockRollDice).toMatchSnapshot();
    expect(mockValidator).toMatchSnapshot();
    expect(mockEmailManager).toMatchSnapshot();
    expect(mockDbHandler).toMatchSnapshot();
    expect(mockDbHandler.prototype.setupDb).toMatchSnapshot();
    expect(mockRouter.get).toMatchSnapshot();
    expect(mockRouter.post).toMatchSnapshot();
    expect(mockRouter.use).toMatchSnapshot();
  });
});

jest.mock('liquidjs', () => () => ({
  name: 'Liquid Module',
  args: arguments,
  express: jest.fn().mockReturnValue('Express Router'),
}));
jest.mock('../src/api/api', () => () => 'API Module');
jest.mock('../src/user/user', () => () => 'User Module');

const bodyParser = require('body-parser');
bodyParser.json = jest.fn(() => 'JSON Parser');
bodyParser.urlencoded = jest.fn().mockReturnValue('urlencoded');

const mockedApp = {
  use: jest.fn(),
  engine: jest.fn(),
  set: jest.fn(),
  listen: jest.fn(),
};

const mockRouter = {
  use: jest.fn(),
};
const mockExpress = jest.fn().mockReturnValue(mockedApp);
mockExpress.Router = jest.fn().mockReturnValue(mockRouter);
mockExpress.static = jest.fn().mockReturnValue('Static');

jest.mock('express', () => mockExpress);

const controller = require('../src/controller');

describe('The controller', () => {
  it('should setup the routes correctly', () => {
    controller(1337, {});

    expect(mockExpress).toMatchSnapshot();
    expect(mockExpress.Router).toMatchSnapshot();
    expect(mockRouter.use).toMatchSnapshot();
    expect(mockedApp.use).toMatchSnapshot();
    expect(mockedApp.engine).toMatchSnapshot();
    expect(mockedApp.set).toMatchSnapshot();
    expect(mockedApp.listen).toMatchSnapshot();
  });
});

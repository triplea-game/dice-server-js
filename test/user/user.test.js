const user = require('../../src/user/user');

describe('The user module', () => {
  const router = {
    get: jest.fn(),
  };

  const getHandlerForRoute = (route) => {
    user(router);
    expect(router.get).toHaveBeenCalledWith(route, expect.any(Function));
    const result = router.get.mock.calls.find(call => call[0] === route);
    if (result) {
      return result[1];
    }
    throw `No Route with name ${route} was registered`;
  };

  const res = {
    render: jest.fn(),
  };

  it('should return the passed router instance', () => {
    expect(user(router)).toBe(router);
  });

  it('should trigger the correct render on /', () => {
    const handler = getHandlerForRoute('/');

    handler(undefined, res);

    expect(res).toMatchSnapshot();
  });

  it('should trigger the correct render on /verify', () => {
    const handler = getHandlerForRoute('/verify');

    handler({
      query: {
        token: Buffer.from(JSON.stringify({
          dice: [0, 1, 1, 2, 3, 5, 8, 13],
          date: 626644800,
          signature: 'VGhlcmUgYXJlIG90aGVyIHNlY3JldHM='
        })).toString('base64'),
      },
    }, res);

    expect(res).toMatchSnapshot();
  });

  it('should trigger the correct render on /verify with invalid params', () => {
    const handler = getHandlerForRoute('/verify');

    handler({}, res);

    expect(res).toMatchSnapshot();
  });

  it('should trigger the correct render on /register', () => {
    const handler = getHandlerForRoute('/register');

    handler({
      query: {
        email: 'itsame@mario.com',
        token: 'My4xNDE1OTI2NTM1ODk3OTMyMzg0NjI2NDMzOA==',
      },
    }, res);

    expect(res).toMatchSnapshot();
  });

  it('should trigger the correct render on /unregister', () => {
    const handler = getHandlerForRoute('/unregister');

    handler({
      query: {
        email: 'itsame@luigi.com',
      },
    }, res);

    expect(res).toMatchSnapshot();
  });
});

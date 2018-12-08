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


describe('The API routing process', () => {
  const mockRouter = {
    get: jest.fn(),
    post: jest.fn(),
    use: jest.fn(),
  };

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

describe('The API\'s', () => {
  const next = jest.fn();
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(),
  };

  const expectStatusAndErrors = (status, ...expectedErrors) => {
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledTimes(1);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Error',
      errors: expect.arrayContaining(expectedErrors),
    }));
    expect(next).not.toHaveBeenCalled();
  }

  it('isEmail function should reject invalid emails', () => {
    expect(api.Api.isEmail('name.sirname@provider.tl')).toBe(true);
    expect(api.Api.isEmail('prefix+something@gmail.com')).toBe(true);
    expect(api.Api.isEmail('hax+0rs@cr4zyd0main.org')).toBe(true);


    expect(api.Api.isEmail('')).toBe(false);
    expect(api.Api.isEmail('         ')).toBe(false);
    expect(api.Api.isEmail('me@google')).toBe(false);
    expect(api.Api.isEmail('me@gmail.com you@gmail.com')).toBe(false);
    expect(api.Api.isEmail('"Display Name" <actual@email.com>')).toBe(false);
  });

  describe('registrationMiddleware should', () => {
    const emailRegistered = 'REGISTERED';
    const emailUnregistered = 'NOT REGISTERED';
    const fakeDbHandler = {
      checkMail: jest.fn(email => Promise.resolve(email === emailRegistered)),
    };
    const registrationMiddleware = api.Api.prototype.registrationMiddleware.bind({
      dbHandler: fakeDbHandler,
    });

    it('fail correctly on wrong email1 input', async () => {
      await registrationMiddleware({
        body: {
          email1: emailUnregistered,
          email2: emailRegistered,
        }
      }, res, next);
      expectStatusAndErrors(
        403,
        expect.stringContaining(emailUnregistered),
        expect.stringContaining(emailRegistered)
      );
    });

    it('fail correctly on wrong email2 input', async () => {
      await registrationMiddleware({
        body: {
          email1: emailRegistered,
          email2: emailUnregistered,
        }
      }, res, next);
      expectStatusAndErrors(
        403,
        expect.stringContaining(emailRegistered),
        expect.stringContaining(emailUnregistered)
      );
    });

    it('fail correctly on 2 wrong email inputs', async () => {
      await registrationMiddleware({
        body: {
          email1: emailUnregistered,
          email2: emailUnregistered,
        }
      }, res, next);
      expectStatusAndErrors(
        403,
        expect.stringContaining(emailUnregistered),
        expect.stringContaining(emailUnregistered)
      );
    });

    it('proceed correctly on correct email inputs', async () => {
      await registrationMiddleware({
        body: {
          email1: emailRegistered,
          email2: emailRegistered,
        }
      }, res, next);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('validateRollArgs middleware should', () => {
    it('call the next middleware when parameters are correct', () => {
      api.Api.validateRollArgs({
        body: {
          times: '99',
          max: '1',
        }
      }, res, next);

      expect(res.json).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });


    describe('reject the response using invalid times parameter', () => {
      it('when too high', () => {
        api.Api.validateRollArgs({
          body: {
            times: '101',
            max: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/times.*101.*high/)
        );
      });

      it('when too low', () => {
        api.Api.validateRollArgs({
          body: {
            times: '0',
            max: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/times.*0.*less/)
        );
      });

      it('when not an integer', () => {
        api.Api.validateRollArgs({
          body: {
            times: 'Definitely not an int',
            max: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/times.*not.*Integer/)
        );
      });

      it('when not defined', () => {
        api.Api.validateRollArgs({
          body: {
            max: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/times.*not.*defined/)
        );
      });
    });

    describe('reject the response using invalid times parameter', () => {
      it('when too high', () => {
        api.Api.validateRollArgs({
          body: {
            max: '123',
            times: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/max.*123.*high/)
        );
      });

      it('when too low', () => {
        api.Api.validateRollArgs({
          body: {
            max: '-12',
            times: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/max.*-12.*less/)
        );
      });

      it('when not an integer', () => {
        api.Api.validateRollArgs({
          body: {
            max: 'Not an int either',
            times: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/max.*not.*Integer/)
        );
      });

      it('when not defined', () => {
        api.Api.validateRollArgs({
          body: {
            times: '6',
          }
        }, res, next);

        expectStatusAndErrors(
          422,
          expect.stringMatching(/max.*not.*defined/)
        );
      });
    });
  });

  it('handleRoll middleware should roll correctly', async () => {
    mockRollDice.mockImplementationOnce(() => Promise.resolve([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
    Date.now = jest.fn(() => 1234567890);
    const fakeInstance = {
      validator: {
        sign: jest.fn(() => 'My signature'),
      },
      emailManager: {
        sendDiceVerificationEmail: jest.fn(() => Promise.resolve()),
      },
    };
    await api.Api.prototype.handleRoll.bind(fakeInstance)({
      body: {
        max: 9,
        times: 10,
        email1: 'Email 1',
        email2: 'Email 2',
      }
    }, res, next);

    expect(mockRollDice).toHaveBeenCalledTimes(1);
    expect(mockRollDice).toHaveBeenCalledWith(9, 10);
    expect(Date.now).toHaveBeenCalledTimes(1);
    expect(fakeInstance.validator.sign).toHaveBeenCalledTimes(1);
    expect(fakeInstance.validator.sign).toHaveBeenCalledWith([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1234567890
    ]);
    expect(fakeInstance.emailManager.sendDiceVerificationEmail).toHaveBeenCalledTimes(1);
    expect(fakeInstance.emailManager.sendDiceVerificationEmail).toHaveBeenCalledWith(
      'Email 1', 'Email 2', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'My signature', 1234567890
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled(); // Means status 200
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'OK',
      result: {
        dice: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        signature: 'My signature',
        date: 1234567890
      }
    }));
  });

  it('test to be added', () => {
    /* missing tests
    validateVerifyArgs()

    handleVerify()

    handleEmailRegister()

    handleEmailRegisterConfirm()

    handleEmailUnregister()

    verifyEmailParam()
    */
  });
});

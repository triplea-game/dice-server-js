const {
  serverBaseUrl, registrationLink, unregisterLink, verifyLink,
} = require('../../src/core/links');

describe('serverBaseUrl', () => {
  it('omits the port for http on 80', () => {
    expect(serverBaseUrl({
      protocol: 'http', host: 'dice.example.org', port: 80, baseurl: '',
    })).toBe('http://dice.example.org');
  });

  it('omits the port for https on 443', () => {
    expect(serverBaseUrl({
      protocol: 'https', host: 'dice.example.org', port: 443, baseurl: '/dice',
    })).toBe('https://dice.example.org/dice');
  });

  it('keeps a non-default port', () => {
    expect(serverBaseUrl({
      protocol: 'https', host: 'dice.example.org', port: 80, baseurl: '',
    })).toBe('https://dice.example.org:80');
  });
});

describe('registrationLink', () => {
  it('URL-encodes a plus in the email and the base64 token', () => {
    const server = {
      protocol: 'https', host: 'dice.example.org', port: 443, baseurl: '',
    };

    expect(registrationLink(server, 'a+b@example.com', 'ab+/=')).toBe(
      'https://dice.example.org/register?email=a%2Bb%40example.com&token=ab%2B%2F%3D',
    );
  });
});

describe('unregisterLink', () => {
  it('prefills the email when one is given', () => {
    const server = {
      protocol: 'https', host: 'dice.example.org', port: 443, baseurl: '',
    };

    expect(unregisterLink(server, 'a+b@example.com')).toBe('https://dice.example.org/unregister?email=a%2Bb%40example.com');
  });

  it('links to the bare page when no email is given', () => {
    const server = {
      protocol: 'https', host: 'dice.example.org', port: 443, baseurl: '',
    };

    expect(unregisterLink(server)).toBe('https://dice.example.org/unregister');
  });
});

describe('verifyLink', () => {
  it('carries a v2 base64 token holding every roll field and the signature', () => {
    const server = {
      protocol: 'https', host: 'dice.example.org', port: 443, baseurl: '',
    };
    const roll = {
      dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000,
    };

    const link = verifyLink(server, roll, 'SIG');
    const token = decodeURIComponent(link.split('?token=')[1]);

    expect(link.startsWith('https://dice.example.org/verify?token=')).toBe(true);
    expect(JSON.parse(Buffer.from(token, 'base64').toString())).toEqual({
      v: 2, dice: [3, 6], max: 6, times: 2, email1: 'a@example.com', email2: 'b@example.com', date: 1700000000000, signature: 'SIG',
    });
  });
});

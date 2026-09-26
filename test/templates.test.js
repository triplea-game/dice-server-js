const { createTemplateEngine } = require('../src/templates');

describe('createTemplateEngine', () => {
  it('escapes a script tag smuggled into a verify link email', async () => {
    const html = await createTemplateEngine().renderFile('verify.html', {
      token: 'abc',
      dice: [3, 5],
      date: 'Sat, 26 Sep 2026 12:00:00 GMT',
      times: 2,
      max: 6,
      email1: '<script>alert(1)</script>',
      email2: 'b@example.com',
      legacy: false,
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('rolled for &lt;script&gt;alert(1)&lt;/script&gt; and b@example.com');
  });

  it('escapes a quote-breaking token in the form action attribute', async () => {
    const html = await createTemplateEngine().renderFile('verify.html', {
      token: 'x"><img src=x onerror=alert(1)>',
      dice: [3],
      date: 'Sat, 26 Sep 2026 12:00:00 GMT',
      legacy: true,
    });

    expect(html).not.toContain('<img');
    expect(html).toContain('action="./api/verify/x&#34;&gt;&lt;img src=x onerror=alert(1)&gt;"');
  });

  it('keeps the verify URL out of the inline script', async () => {
    const html = await createTemplateEngine().renderFile('verify.html', {
      token: 'abc',
      dice: [3],
      date: 'Sat, 26 Sep 2026 12:00:00 GMT',
      legacy: true,
    });

    const inlineScript = html.slice(html.lastIndexOf('<script'));
    expect(inlineScript).not.toContain('./api/verify');
  });
});

// Startup against a real socket: a port that can't be bound must fail
// startServer's promise, so dice-server.js exits 1 instead of logging "Running".
const net = require('net');
const express = require('express');
const { listen } = require('../../src/server');

describe('listen', () => {
  it('resolves with a server bound to the port', async () => {
    const server = await listen(express(), 0);

    expect(server.address().port).toBeGreaterThan(0);
    await new Promise((resolve) => { server.close(resolve); });
  });

  it('rejects with EADDRINUSE when the port is already taken', async () => {
    const occupant = net.createServer();
    await new Promise((resolve) => { occupant.listen(0, resolve); });
    const { port } = occupant.address();

    await expect(listen(express(), port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await new Promise((resolve) => { occupant.close(resolve); });
  });
});

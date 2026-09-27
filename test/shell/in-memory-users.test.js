const { describeUsersContract } = require('../contract/users-contract');
const InMemoryUsers = require('../fakes/in-memory-users');

describeUsersContract('InMemoryUsers', () => new InMemoryUsers(), () => new InMemoryUsers());

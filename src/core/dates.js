// Roll times as shown on the verify page and in the roll email. Players are
// in different zones, so the time is always UTC and says so.
const formatUtc = (millis) => `${new Date(millis).toISOString().replace('T', ' ').slice(0, 19)} UTC`;

module.exports = { formatUtc };

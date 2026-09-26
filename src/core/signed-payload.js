const PAYLOAD_VERSION = 2;

// Key order is fixed by this literal, so the same roll always yields the same bytes.
const signedPayload = ({
  dice, max, times, email1, email2, date,
}) => JSON.stringify({
  v: PAYLOAD_VERSION, dice, max, times, email1, email2, date,
});

// LEGACY (tokens without `v`): delete once old emailed links no longer matter.
// Buffer.from(number[]) keeps only each number's low byte, so this binds almost nothing.
const legacySignedPayload = (dice, date) => Buffer.from([...dice, date]);

module.exports = { PAYLOAD_VERSION, signedPayload, legacySignedPayload };

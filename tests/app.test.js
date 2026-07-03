const assert = require('node:assert/strict');
const test = require('node:test');

const { getDrawCount, parseNotes, pickRandomCards } = require('../app.js');

test('parseNotes splits notes on --- separators', () => {
  assert.deepEqual(parseNotes('Alpha\n---\nBeta\n---\nGamma'), ['Alpha', 'Beta', 'Gamma']);
});

test('parseNotes treats non-empty lines as cards when no separator exists', () => {
  assert.deepEqual(parseNotes('Alpha\n\nB\nBeta'), ['Alpha', 'Beta']);
});

test('getDrawCount clamps custom draws to available cards', () => {
  assert.equal(getDrawCount('n', 12, 5), 5);
  assert.equal(getDrawCount('n', 0, 8), 3);
  assert.equal(getDrawCount('2', 8, 1), 1);
});

test('pickRandomCards returns unique cards without mutating the source', () => {
  const cards = [
    { id: 'a', content: 'Alpha' },
    { id: 'b', content: 'Beta' },
    { id: 'c', content: 'Gamma' },
  ];

  const selected = pickRandomCards(cards, 2, () => 0.4);

  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map((card) => card.id)).size, 2);
  assert.deepEqual(cards.map((card) => card.id), ['a', 'b', 'c']);
});

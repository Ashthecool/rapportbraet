// Checks the board's merging. Usage: node merge.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// merge.js is a plain script for the page, so it is loaded the same way here.
vm.runInThisContext(readFileSync(new URL('./merge.js', import.meta.url), 'utf8'));
const { mergeText, mergeItems } = vm.runInThisContext('({ mergeText, mergeItems })');

// Changes in different paragraphs both go in.
assert.equal(mergeText('a\nb\nc', 'A\nb\nc', 'a\nb\nC'), 'A\nb\nC');
// A paragraph one person deleted stays deleted, unlike keeping every line either side has.
assert.equal(mergeText('a\nb\nc', 'a\nc', 'a\nb\nc\nd'), 'a\nc\nd');
// Editing a line replaces it instead of leaving the old one as well.
assert.equal(mergeText('a\nb', 'a\nb', 'a\nB'), 'a\nB');
// Two edits to different words of the same paragraph both go in.
assert.equal(mergeText('Vi laver et spil om jern', 'Vi laver et brætspil om jern', 'Vi laver et spil om aske'), 'Vi laver et brætspil om aske');
// Both changed the same word: both versions are kept, so nothing disappears.
const clash = mergeText('Spillet er sjovt', 'Spillet er godt', 'Spillet er svært');
assert.match(clash, /godt/); assert.match(clash, /svært/);
// Both added a paragraph at the end: each keeps its own line.
assert.equal(mergeText('a', 'a\nmin', 'a\nderes'), 'a\nmin\nderes');
// Same edit on both sides counts once.
assert.equal(mergeText('a', 'a b', 'a b'), 'a b');
// Starting from nothing.
assert.equal(mergeText('', 'min', 'deres'), 'min\nderes');
// Long text with a change at each end stays quick and correct.
const long = Array.from({ length: 5000 }, (_, i) => `linje ${i}`);
const atEnds = mergeText(long.join('\n'), ['ny', ...long].join('\n'), [...long, 'slut'].join('\n')).split('\n');
assert.deepEqual([atEnds[0], atEnds.at(-1), atEnds.length], ['ny', 'slut', 5002]);

const row = (q, a = '', who = '') => ({ q, a, who });
const isChoice = (k) => k === 'who';
const items = (b, m, t) => mergeItems(b, m, t, isChoice);
// Each adds a row: both stay.
assert.deepEqual(items([row('1')], [row('1'), row('2')], [row('1'), row('3')]), [row('1'), row('2'), row('3')]);
// Editing different rows: both edits stay, with no duplicates.
assert.deepEqual(items([row('1'), row('2')], [row('1', 'x'), row('2')], [row('1'), row('2', 'y')]), [row('1', 'x'), row('2', 'y')]);
// Editing different fields of the same row: both stay.
assert.deepEqual(items([row('1')], [row('1', 'svar')], [row('1', '', 'ane')]), [row('1', 'svar', 'ane')]);
// Editing a row while the other adds one: no stale copy of the old row.
assert.deepEqual(items([row('1')], [row('1', 'x')], [row('1'), row('2')]), [row('1', 'x'), row('2')]);
// A deleted row stays deleted when the other didn't touch it.
assert.deepEqual(items([row('1'), row('2')], [row('2')], [row('1'), row('2'), row('3')]), [row('2'), row('3')]);
// A row one deleted and the other edited stays, because the edit is new work.
assert.deepEqual(items([row('1')], [], [row('1', 'x')]), [row('1', 'x')]);
// A move and an edit don't scramble rows into each other or bring back the old row.
assert.deepEqual(items([row('1'), row('2')], [row('2'), row('1')], [row('1', 'x'), row('2')]), [row('1', 'x'), row('2')]);
// A choice can't hold two values, so the one saving now decides.
assert.deepEqual(items([row('1', '', 'a')], [row('1', '', 'b')], [row('1', '', 'c')]), [row('1', '', 'b')]);

console.log('Merging: all checks passed.');

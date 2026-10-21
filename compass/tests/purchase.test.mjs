import { fixture } from "./purchase-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { validatePurchase, purchaseSummary, createScenario } from "../lib/purchase.ts";
import { parseData } from "../lib/finance.ts";
// Synthetic fixtures only. Personal initial data must never enter this repository.

test("budget counts fees once, excludes limits and repayment resources", () => {
  const p = validatePurchase(fixture());
  const s = purchaseSummary(p);
  assert.equal(s.required, 11200);
  assert.equal(s.expected, 11000);
  assert.equal(s.secured, 1000);
  assert.equal(s.paid, 1000);
  assert.equal(s.remaining, 10200);
  assert.equal(s.scheduleGap, 0);
  assert.equal(s.balance, null);
  assert.equal(s.afterPaid, 800);
  assert.equal(s.includesPaid, -200);
  assert.equal(s.unknownAmounts, 1);
  assert.equal(s.unknownActual, 2);
});
test("basis is explicit and unknown payments are not paid", () => {
  const p = fixture();
  p.basis = "after-paid";
  assert.equal(purchaseSummary(p).balance, 800);
  p.basis = "includes-paid";
  assert.equal(purchaseSummary(p).balance, -200);
  p.payments[1] = { ...p.payments[1], status: "partial", actualAmount: 500, actualDate: "2030-02-01" };
  assert.equal(purchaseSummary(validatePurchase(p)).paid, 1500);
});
test("simulation recalculates loan interest, tax installments and fees without changing records", () => {
  const p = fixture(); p.basis = "after-paid";
  const before = JSON.stringify(p);
  const s = createScenario(p);
  s.taxMode = "card"; s.months = 10; s.fee = 100;
  s.funding[0].apr = 12;
  s.costs[1].amount = 500;
  const result = purchaseSummary(validatePurchase({ ...p, scenario: s }), s);
  assert.equal(result.interest, 80);
  assert.equal(result.cardPrincipal, 90);
  assert.equal(result.cardFee, 10);
  assert.equal(result.monthly, 180);
  assert.equal(result.balance, 600);
  assert.equal(result.immediateBalance, 1500);
  assert.equal(JSON.stringify(p), before);
  s.funding[0].amount = 9000;
  assert.equal(purchaseSummary(p, s).balance, 1600);
});
test("tax actuals reduce remaining card principal and add to paid only once", () => {
  const p = fixture(); p.tax = { ...p.tax, mode: "card", actualAmount: 100, actualDate: "2030-01-02", fee: null };
  const s = purchaseSummary(validatePurchase(p));
  assert.equal(s.paid, 1100);
  assert.equal(s.cardPrincipal, 80);
  assert.equal(s.unknownFee, true);
  p.funding[0].apr = null;
  assert.equal(purchaseSummary(p).unknownInterest, true);
});
test("unknown amount differs from confirmed zero and survives backup", () => {
  const p = fixture();
  p.funding[2].expected = 0;
  assert.equal(purchaseSummary(p).unknownAmounts, 0);
  const data = { transactions: [], assets: [], purchase: { ...p, scenario: createScenario(p) } };
  assert.deepEqual(parseData(JSON.stringify(data)), data);
  assert.deepEqual(parseData('{"transactions":[],"assets":[]}'), { transactions: [], assets: [] });
});
test("invalid imported plans and unsafe aggregate amounts are rejected", () => {
  const cases = [
    p => { p.version = 2; },
    p => { p.funding[0].expected = -1; },
    p => { p.funding[0].expected = 20001; },
    p => { p.funding[0].actual = 20001; },
    p => { p.funding[0].expected = 0.1; },
    p => { p.funding[0].apr = 101; },
    p => { p.funding[0].id = p.funding[1].id; },
    p => { p.funding[0].securedDate = "2030-02-30"; },
    p => { p.payments[0].actualDate = null; },
    p => { p.payments[1].actualAmount = 100; },
    p => { p.tax.months = 0; },
    p => { p.tax.fee = "100"; },
    p => { p.tax.note = "x".repeat(1001); },
    p => { p.costs[0].amount = Number.MAX_SAFE_INTEGER; },
    p => { p.scenario = createScenario(p); p.scenario.funding[0].amount = 20001; },
    p => { p.scenario = createScenario(p); p.scenario.costs[0].id = "missing"; },
  ];
  for (const change of cases) {
    const p = fixture(); change(p);
    assert.throws(() => validatePurchase(p));
    assert.throws(() => parseData(JSON.stringify({ transactions: [], assets: [], purchase: p })));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  monthlySummary,
  spendingByCategory,
  assetSummary,
  parseData,
  validAmount,
} from "../lib/finance.ts";
const transaction = {
  id: "t1",
  date: "2026-10-01",
  type: "income",
  title: "월급",
  category: "급여",
  amount: 3000000,
};
const asset = {
  id: "a1",
  kind: "saving",
  name: "적금",
  note: "",
  amount: 1000000,
};
test("monthly totals exclude other months and separate income from spending", () => {
  const result = monthlySummary(
    [
      transaction,
      { ...transaction, id: "t2", type: "expense", amount: 12000 },
      { ...transaction, id: "t3", date: "2026-09-30" },
    ],
    "2026-10",
  );
  assert.equal(result.rows.length, 2);
  assert.equal(result.income, 3000000);
  assert.equal(result.expense, 12000);
  assert.equal(result.balance, 2988000);
  assert.equal(monthlySummary([], "2026-10").balance, 0);
});
test("loans reduce net worth without being counted as assets", () => {
  assert.deepEqual(
    assetSummary([
      asset,
      { ...asset, id: "a2", kind: "realestate", amount: 200000000 },
      { ...asset, id: "a3", kind: "stock", amount: 500000 },
      { ...asset, id: "a4", kind: "loan", amount: 300000000 },
    ]),
    { total: 201500000, debt: 300000000, net: -98500000 },
  );
});
test("backup round trip preserves financial records", () => {
  const data = { transactions: [transaction], assets: [asset] };
  assert.deepEqual(parseData(JSON.stringify(data)), data);
});
test("invalid backup cannot overwrite saved data", () => {
  for (const raw of [
    "null",
    "{}",
    "invalid",
    JSON.stringify({ transactions: [transaction, transaction], assets: [] }),
    JSON.stringify({
      transactions: [{ ...transaction, date: "2026-02-30" }],
      assets: [],
    }),
    JSON.stringify({
      transactions: [],
      assets: [{ ...asset, kind: "__proto__" }],
    }),
  ])
    assert.throws(() => parseData(raw));
});
test("amounts must be positive safe whole won values", () => {
  for (const amount of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "100",
  ])
    assert.equal(validAmount(amount), false);
  assert.equal(validAmount(100), true);
});


test("empty and invalid month selections never combine unrelated months", () => {
  for (const month of ["", "2026", "2026-1", "2026-00", "2026-13"]) {
    assert.deepEqual(monthlySummary([transaction], month), {
      rows: [], income: 0, expense: 0, balance: 0,
    });
  }
});
test("category totals handle object property names and exclude income", () => {
  const rows = [
    { ...transaction, type: "expense", category: "__proto__", amount: 100 },
    { ...transaction, type: "expense", category: "constructor", amount: 200 },
    { ...transaction, type: "expense", category: "__proto__", amount: 300 },
    { ...transaction, type: "expense", category: "toString", amount: 50 },
    { ...transaction, category: "constructor", amount: 10000 },
  ];
  assert.deepEqual(spendingByCategory(rows), [
    ["__proto__", 400], ["constructor", 200], ["toString", 50],
  ]);
  assert.deepEqual(spendingByCategory([]), []);
});

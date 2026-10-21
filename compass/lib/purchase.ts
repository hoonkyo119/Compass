export type Money = number | null;
export type Cost = { id: string; name: string; kind: "price" | "fee" | "tax"; amount: Money };
export type Payment = {
  id: string; name: string; dueDate: string | null; amount: Money;
  status: "unknown" | "planned" | "partial" | "paid";
  actualDate: string | null; actualAmount: Money;
};
export type Funding = {
  id: string; owner: string; name: string; limit: Money; gross: Money;
  expected: Money; actual: Money; securedDate: string | null;
  loan: boolean; apr: Money; purpose: "purchase" | "repayment";
  needsReview: boolean; note: string;
};
export type Scenario = {
  funding: { id: string; amount: Money; apr: Money }[];
  costs: { id: string; amount: Money }[];
  taxMode: "cash" | "card"; months: number; fee: Money;
};
export type Purchase = {
  version: 1; name: string; basis: "unknown" | "after-paid" | "includes-paid";
  costs: Cost[]; payments: Payment[]; funding: Funding[];
  tax: { mode: "cash" | "card"; months: number; fee: Money; note: string;
    actualAmount: Money; actualDate: string | null };
  scenario: Scenario | null;
};
export function newPurchase(): Purchase {
  return { version: 1, name: "부동산 매매", basis: "unknown", costs: [], payments: [], funding: [],
    tax: { mode: "cash", months: 10, fee: null, note: "", actualAmount: null, actualDate: null }, scenario: null };
}
function fail(): never { throw new Error("부동산 매매 데이터의 형식·금액·날짜를 확인해 주세요."); }
function object(v: unknown): asserts v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail();
}
function text(v: unknown, max = 200, required = false): asserts v is string {
  if (typeof v !== "string" || v.length > max || (required && !v.trim())) fail();
}
function money(v: unknown): asserts v is Money {
  if (v !== null && (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0)) fail();
}
function rate(v: unknown) {
  if (v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100)) fail();
}
function date(v: unknown) {
  if (v !== null && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)) fail();
}
function choice(v: unknown, values: unknown[]) { if (!values.includes(v)) fail(); }
function rows(v: unknown): asserts v is Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > 1000) fail();
  const ids = new Set();
  for (const row of v) {
    object(row); text(row.id, 100, true);
    if (ids.has(row.id)) fail();
    ids.add(row.id);
  }
}
function taxSettings(v: Record<string, unknown>) {
  choice(v.mode ?? v.taxMode, ["cash", "card"]);
  if (!Number.isInteger(v.months) || (v.months as number) < 1 || (v.months as number) > 120) fail();
  money(v.fee);
}
export function validatePurchase(value: unknown): Purchase {
  object(value);
  if (value.version !== 1) fail();
  text(value.name, 80, true); choice(value.basis, ["unknown", "after-paid", "includes-paid"]);
  rows(value.costs); rows(value.payments); rows(value.funding);
  for (const row of value.costs) {
    text(row.name, 80, true); choice(row.kind, ["price", "fee", "tax"]); money(row.amount);
  }
  for (const row of value.payments) {
    text(row.name, 80, true); money(row.amount); money(row.actualAmount);
    date(row.dueDate); date(row.actualDate); choice(row.status, ["unknown", "planned", "partial", "paid"]);
    if ((row.status === "paid" || row.status === "partial") &&
      (row.actualAmount === null || row.actualDate === null)) fail();
    if ((row.status === "unknown" || row.status === "planned") &&
      (row.actualAmount !== null || row.actualDate !== null)) fail();
  }
  for (const row of value.funding) {
    text(row.owner, 80); text(row.name, 80, true); text(row.note, 1000);
    money(row.limit); money(row.gross); money(row.expected); money(row.actual); rate(row.apr); date(row.securedDate);
    if (typeof row.loan !== "boolean" || typeof row.needsReview !== "boolean") fail();
    choice(row.purpose, ["purchase", "repayment"]);
    if (row.securedDate !== null && row.actual === null) fail();
    if (row.loan && row.limit !== null &&
      ((row.expected !== null && (row.expected as number) > (row.limit as number)) ||
       (row.actual !== null && (row.actual as number) > (row.limit as number)))) fail();
  }
  object(value.tax); taxSettings(value.tax); text(value.tax.note, 1000);
  money(value.tax.actualAmount); date(value.tax.actualDate);
  if (value.tax.actualDate !== null && value.tax.actualAmount === null) fail();
  if (value.scenario !== null) {
    object(value.scenario); taxSettings(value.scenario); rows(value.scenario.funding); rows(value.scenario.costs);
    for (const row of value.scenario.funding) {
      const source = value.funding.find(f => f.id === row.id);
      if (!source) fail();
      money(row.amount); rate(row.apr);
      if (source.loan && source.limit !== null && row.amount !== null && (row.amount as number) > (source.limit as number)) fail();
    }
    for (const row of value.scenario.costs) {
      if (!value.costs.some(c => c.id === row.id)) fail();
      money(row.amount);
    }
  }
  const scenario = value.scenario as Scenario | null;
  // Guard aggregate arithmetic as well as individual values.
  for (const group of [value.costs.map(r => r.amount), value.payments.map(r => r.actualAmount),
    value.funding.map(r => r.expected), value.funding.map(r => r.actual),
    scenario?.costs.map(r => r.amount) ?? [], scenario?.funding.map(r => r.amount) ?? []]) {
    sum(group as Money[]);
  }
  return value as unknown as Purchase;
}
export function sum(values: Money[]) {
  const total = values.reduce<number>((n, v) => n + (v ?? 0), 0);
  if (!Number.isSafeInteger(total)) fail();
  return total;
}
export function createScenario(p: Purchase): Scenario {
  return { funding: p.funding.map(r => ({ id: r.id, amount: r.expected, apr: r.apr })),
    costs: p.costs.map(r => ({ id: r.id, amount: r.amount })),
    taxMode: p.tax.mode, months: p.tax.months, fee: p.tax.fee };
}
export function purchaseSummary(p: Purchase, scenario: Scenario | null = null) {
  const costs = p.costs.map(c => ({ ...c, amount: scenario?.costs.find(s => s.id === c.id)?.amount === undefined
    ? c.amount : scenario.costs.find(s => s.id === c.id)!.amount }));
  const funding = p.funding.filter(f => f.purpose === "purchase").map(f => {
    const override = scenario?.funding.find(s => s.id === f.id);
    return { ...f, expected: override ? override.amount : f.expected, apr: override ? override.apr : f.apr };
  });
  const required = sum(costs.map(c => c.amount));
  const tax = sum(costs.filter(c => c.kind === "tax").map(c => c.amount));
  const expected = sum(funding.map(f => f.expected));
  const secured = sum(funding.map(f => f.actual));
  const paid = sum([...p.payments.map(r => r.actualAmount), p.tax.actualAmount]);
  const remaining = required - paid;
  const includesPaid = expected - required;
  const afterPaid = expected - remaining;
  const settings = scenario ?? { taxMode: p.tax.mode, months: p.tax.months, fee: p.tax.fee };
  const loans = funding.filter(f => f.loan && (f.expected === null || f.expected > 0));
  const interest = loans.reduce((n, f) => n + (f.expected ?? 0) * (f.apr ?? 0) / 1200, 0);
  const taxRemaining = Math.max(0, tax - (p.tax.actualAmount ?? 0));
  const cardPrincipal = settings.taxMode === "card" ? taxRemaining / settings.months : 0;
  const cardFee = settings.taxMode === "card" ? (settings.fee ?? 0) / settings.months : 0;
  const unknownAmounts = costs.filter(c => c.amount === null).length + funding.filter(f => f.expected === null).length;
  const unknownInterest = loans.some(f => f.apr === null || f.expected === null);
  const provisional = unknownAmounts > 0 || funding.some(f => f.needsReview);
  return { required, tax, expected, secured, paid, remaining, includesPaid, afterPaid,
    balance: p.basis === "unknown" ? null : p.basis === "after-paid" ? afterPaid : includesPaid,
    unknownAmounts, unknownInterest, provisional,
    unknownActual: funding.filter(f => f.actual === null).length,
    interest, cardPrincipal, cardFee, monthly: interest + cardPrincipal + cardFee,
    unknownFee: settings.taxMode === "card" && settings.fee === null,
    immediateBalance: p.basis === "unknown" ? null :
      (p.basis === "after-paid" ? afterPaid : includesPaid) + (settings.taxMode === "card" ? taxRemaining : 0),
    scheduleGap: sum(costs.filter(c => c.kind !== "tax").map(c => c.amount)) - sum(p.payments.map(r => r.amount)),
    taxMode: settings.taxMode,
  };
}

export type Transaction = {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  title: string;
  amount: number;
};
export type AssetKind = "realestate" | "stock" | "saving" | "loan";
export type Asset = {
  id: string;
  kind: AssetKind;
  name: string;
  amount: number;
  note: string;
};
export type FinanceData = { transactions: Transaction[]; assets: Asset[] };
export const storageKey = "compass-v0.1";
export const assetLabels: Record<AssetKind, string> = {
  realestate: "부동산",
  stock: "주식",
  saving: "저축",
  loan: "대출",
};
export const won = (value: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
export function monthlySummary(transactions: Transaction[], month: string) {
  const rows = transactions.filter((item) => item.date.startsWith(month));
  const income = rows
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = rows
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  return { rows, income, expense, balance: income - expense };
}
export function assetSummary(assets: Asset[]) {
  const total = assets
    .filter((item) => item.kind !== "loan")
    .reduce((sum, item) => sum + item.amount, 0);
  const debt = assets
    .filter((item) => item.kind === "loan")
    .reduce((sum, item) => sum + item.amount, 0);
  return { total, debt, net: total - debt };
}
export function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function parseData(raw: string): FinanceData {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.assets))
    throw new Error("지원하지 않는 백업 형식입니다.");
  const ids = new Set<string>();
  for (const row of [...data.transactions, ...data.assets]) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      ids.has(row.id) ||
      !validAmount(row.amount)
    )
      throw new Error("금액 또는 식별자가 올바르지 않습니다.");
    ids.add(row.id);
  }
  for (const row of data.transactions) {
    if (
      !validDate(row.date) ||
      !["income", "expense"].includes(row.type) ||
      typeof row.title !== "string" ||
      !row.title.trim() ||
      typeof row.category !== "string" ||
      !row.category.trim()
    )
      throw new Error("거래 내역이 올바르지 않습니다.");
  }
  for (const row of data.assets) {
    if (
      typeof row.kind !== "string" ||
      !Object.hasOwn(assetLabels, row.kind) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      typeof row.note !== "string"
    )
      throw new Error("자산 내역이 올바르지 않습니다.");
  }
  return { transactions: data.transactions, assets: data.assets };
}

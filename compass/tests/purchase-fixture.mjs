import { newPurchase } from "../lib/purchase.ts";
// Synthetic records only.
export function fixture() {
  const p = newPurchase();
  p.basisPaid = 1000;
  p.costs = [
    { id: "price", name: "매매대금", kind: "price", amount: 10000 },
    { id: "fee", name: "부대비용", kind: "fee", amount: 300 },
    { id: "tax", name: "세금", kind: "tax", amount: 900 },
  ];
  p.payments = [
    { id: "deposit", name: "계약금", dueDate: "2030-01-01", amount: 1000, status: "paid", actualDate: "2030-01-01", actualAmount: 1000 },
    { id: "balance", name: "잔금·부대비용", dueDate: "2030-02-01", amount: 9300, status: "unknown", actualDate: null, actualAmount: null },
  ];
  p.funding = [
    { id: "loan", owner: "", name: "대출", loan: true, limit: 20000, gross: null, expected: 8000, actual: null, securedDate: null, apr: 6, purpose: "purchase", needsReview: true, note: "실행액 확인 필요" },
    { id: "cash", owner: "", name: "현금", loan: false, limit: null, gross: 4000, expected: 3000, actual: 1000, securedDate: "2030-01-01", apr: null, purpose: "purchase", needsReview: false, note: "" },
    { id: "stock", owner: "", name: "미입력 주식", loan: false, limit: null, gross: null, expected: null, actual: null, securedDate: null, apr: null, purpose: "purchase", needsReview: false, note: "" },
    { id: "bonus", owner: "", name: "상환 재원", loan: false, limit: null, gross: null, expected: 5000, actual: null, securedDate: null, apr: null, purpose: "repayment", needsReview: false, note: "매매 투입 제외" },
  ];
  return p;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { won } from "@/lib/finance";
import { createScenario, newPurchase, purchaseSummary, validatePurchase,
  type Purchase, type Cost, type Funding, type Payment, type Money, type Scenario } from "@/lib/purchase";

const amount = (v: Money) => v === null ? "미입력" : won(v);
const statuses = { unknown: "미확인", planned: "예정", partial: "일부 납부", paid: "납부 완료" };
type Section = "costs" | "payments" | "funding" | "settings";
type Field = { key: string; label: string; type?: "number" | "date" | "checkbox"; options?: [string, string][]; required?: boolean; maxLength?: number; step?: string };
const fields: Record<Section, Field[]> = {
  costs: [ { key: "name", label: "항목", required: true },
    { key: "kind", label: "비용 유형", options: [["price", "매매대금"], ["fee", "부대비용"], ["tax", "세금 (일정과 별도)"]] },
    { key: "amount", label: "예상금액 (원)", type: "number" } ],
  payments: [ { key: "name", label: "납부 항목", required: true },
    { key: "dueDate", label: "예정일", type: "date" }, { key: "amount", label: "예정금액 (원)", type: "number" },
    { key: "status", label: "납부 상태", options: Object.entries(statuses) },
    { key: "actualDate", label: "실제 납부일", type: "date" }, { key: "actualAmount", label: "실제 납부금액 (원)", type: "number" } ],
  funding: [ { key: "owner", label: "명의" }, { key: "name", label: "재원 항목", required: true },
    { key: "purpose", label: "용도", options: [["purchase", "매매 투입"], ["repayment", "대출 상환용 (매매 합계 제외)"]] },
    { key: "loan", label: "대출 재원", type: "checkbox" },
    { key: "limit", label: "대출 한도 (합산하지 않음, 원)", type: "number" },
    { key: "gross", label: "세전금액 (참고용, 원)", type: "number" },
    { key: "expected", label: "예상 투입금액 (원)", type: "number" },
    { key: "actual", label: "실제 확보금액 (원)", type: "number" },
    { key: "securedDate", label: "확보일", type: "date" },
    { key: "apr", label: "연 금리 (%)", type: "number", step: "0.001" },
    { key: "needsReview", label: "확인 필요", type: "checkbox" }, { key: "note", label: "확인 메모", maxLength: 1000 } ],
  settings: [ { key: "name", label: "매매 이름", required: true },
    { key: "basis", label: "재원 합계의 기납부 기준", options: [["unknown", "미확인 — 두 기준 함께 표시"], ["after-paid", "기납부 후 가용재원"], ["includes-paid", "기납부액을 포함한 총 재원"]] },
    { key: "mode", label: "세금 납부방식", options: [["cash", "일시납"], ["card", "카드 할부"]] },
    { key: "months", label: "세금 할부 개월", type: "number", required: true },
    { key: "fee", label: "총 할부수수료 (원, 미확정이면 비워두기)", type: "number" },
    { key: "note", label: "세금 납부 조건 메모", maxLength: 1000 },
    { key: "actualAmount", label: "실제 납부한 세금 누계 (원)", type: "number" },
    { key: "actualDate", label: "세금 최근 납부일", type: "date" } ],
};
const sectionNames = { costs: "비용", payments: "납부 일정", funding: "재원", settings: "매매 설정" };
export default function PurchasePanel({ value, onSave, disabled }: {
  value?: Purchase; onSave: (value: Purchase) => boolean; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState<{ section: Section; row: Record<string, unknown> } | null>(null);
  const [simulating, setSimulating] = useState(false);
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (edit) {
      editor.current?.scrollIntoView({ block: "center" });
      editor.current?.querySelector<HTMLInputElement>("input")?.focus();
    }
  }, [edit]);
  function save(next: Purchase) {
    try { validatePurchase(next); if (!onSave(next)) { setMessage("브라우저에 저장하지 못했습니다. 기존 기록은 유지됩니다."); return false; }
      setMessage("부동산 매매 기록을 저장했습니다."); return true;
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "입력을 확인해 주세요."); return false; }
  }
  async function importPlan(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("5MB 이하 JSON 파일만 가져올 수 있습니다.");
      const next = validatePurchase(JSON.parse(await file.text()));
      if (window.confirm("부동산 매매 기록을 파일 내용으로 교체할까요? 가계부와 자산은 유지됩니다.")) {
        if (save(next)) { setEdit(null); setSimulating(false); }
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "파일을 읽지 못했습니다."); }
  }
  function exportPlan() {
    if (!value) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "compass-purchase-private.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function begin(section: Section, row?: Cost | Payment | Funding) {
    if (!value) return;
    const defaults = section === "costs" ? { name: "", kind: "fee", amount: null }
      : section === "payments" ? { name: "", dueDate: null, amount: null, status: "unknown", actualDate: null, actualAmount: null }
      : section === "funding" ? { owner: "", name: "", limit: null, gross: null, expected: null, actual: null,
        securedDate: null, loan: false, apr: null, purpose: "purchase", needsReview: false, note: "" }
      : { name: value.name, basis: value.basis, ...value.tax };
    setEdit({ section, row: { ...defaults, ...(row ?? {}), ...(section === "settings" ? {} : { id: row?.id ?? crypto.randomUUID() }) } });
    setMessage("");
  }
  function submit(form: FormData) {
    if (!edit || !value) return;
    const row: Record<string, unknown> = { ...edit.row };
    for (const field of fields[edit.section]) {
      const raw = String(form.get(field.key) ?? "");
      row[field.key] = field.type === "checkbox" ? form.has(field.key)
        : field.type === "number" ? raw === "" ? null : Number(raw)
        : field.type === "date" ? raw || null : raw.trim();
    }
    const next = structuredClone(value);
    if (edit.section === "settings") {
      next.name = row.name as string; next.basis = row.basis as Purchase["basis"];
      const { name: _name, basis: _basis, ...tax } = row;
      void _name; void _basis;
      next.tax = tax as Purchase["tax"];
    } else {
      // Each section is independently validated before anything reaches storage.
      const section = edit.section;
      const records = next[section] as (Cost | Payment | Funding)[];
      const index = records.findIndex(r => r.id === row.id);
      if (index < 0) records.push(row as Cost | Payment | Funding);
      else records[index] = row as Cost | Payment | Funding;
    }
    next.scenario = null;
    if (save(next)) setEdit(null);
  }
  function remove(section: Exclude<Section, "settings">, id: string) {
    if (!value || !window.confirm("이 기록을 삭제할까요? 저장된 시뮬레이션도 초기화됩니다.")) return;
    const next = structuredClone(value);
    if (section === "costs") next.costs = next.costs.filter(r => r.id !== id);
    if (section === "payments") next.payments = next.payments.filter(r => r.id !== id);
    if (section === "funding") next.funding = next.funding.filter(r => r.id !== id);
    next.scenario = null; save(next);
  }
  const summary = value ? purchaseSummary(value) : null;
  return <section className="purchase" aria-label="부동산 매매">
    <div className="panel-heading purchase-heading"><div><h2>부동산 매매{value ? ` · ${value.name}` : ""}</h2>
      <p>계획과 실제 기록을 나누어 자금의 흐름을 확인해요.</p></div>
      <div className="purchase-actions">
        {value && <><button className="secondary" disabled={disabled} onClick={() => begin("settings")}>매매 설정</button>
          <button className="secondary" disabled={disabled} onClick={exportPlan}>매매 백업</button></>}
        <button className="primary" disabled={disabled} onClick={() => input.current?.click()}>매매 파일 가져오기</button>
        {!value && <button className="secondary" disabled={disabled} onClick={() => save(newPurchase())}>빈 계획 만들기</button>}
        <input type="file" ref={input} hidden accept="application/json,.json" onChange={e => {
          const file = e.target.files?.[0]; e.target.value = ""; void importPlan(file);
        }} />
      </div>
    </div>
    <p className="muted">이 브라우저에만 저장됩니다. 로그인·암호화·기기 간 동기화는 없습니다. 공용 기기 사용을 피하고 백업 파일을 안전하게 보관하세요. 개인 초기 데이터는 매매 파일로 가져오세요.</p>
    <p role="status">{message}</p>
    {!value && <div className="empty"><h3>나의 매매 계획을 시작해요</h3><p>개인 금액과 이름은 공개 앱에 미리 포함하지 않습니다.</p></div>}
    {value && summary && <>
      <div className="summary-grid purchase-summary">
        {[["총 필요금액", summary.required], ["확보·예정 재원", summary.expected], ["실제 확보 (입력분)", summary.secured],
          ["기납부액 (확인분)", summary.paid], ["남은 지출", summary.remaining], ["예상 잔액", summary.balance]].map(([label, money]) =>
          <article className="summary" key={String(label)}><div className="summary-top">{label}</div>
            <strong>{money === null ? "기준 미확인" : won(money as number)}</strong><small>계획 기준 · 미입력/확인 필요 항목은 아래 확인</small></article>)}
      </div>
      <div className="tip purchase-warning"><div><strong>자금계획 확인사항</strong>
        <p>재원은 예상 투입금액만 합산합니다. 한도·세전금액·실제 확보액은 중복 합산하지 않습니다. 상환용 재원은 제외합니다.</p>
        <p>미입력 예상금액 {summary.unknownAmounts}건, 실제 확보 미입력 {summary.unknownActual}건. 미입력은 0원 확정이 아니며 합계는 입력분만 계산합니다.</p>
        <p>기납부 후 가용재원 기준: {won(summary.afterPaid)} / 기납부 포함 총 재원 기준: {won(summary.includesPaid)} (세금 포함).</p>
        {value.basis === "unknown" && <p>기납부액이 재원 합계에 포함되었는지 미확인입니다. 매매 설정에서 기준을 선택하세요.</p>}
        {summary.unknownFee && <p>카드 할부수수료가 미입력입니다. 필요금액과 잔액에는 입력된 수수료만 반영됩니다.</p>}
        <p>세금 납부 조건 (미확정 메모): {value.tax.note || "미입력"}</p>
        {summary.provisional && <p>미입력 또는 확인 필요 재원이 있어 예상 잔액은 잠정값입니다.</p>}
        {summary.scheduleGap !== 0 && <p>세금 제외 비용과 납부 일정의 차이: {won(summary.scheduleGap)}. 중개·등기비를 중복 등록하지 않았는지 확인하세요.</p>}
        {value.payments.some(p => p.status === "unknown") && <p>납부 여부 미확인 일정이 있습니다. 확인 전까지 기납부액에 포함하지 않습니다.</p>}
        {value.funding.filter(f => f.needsReview).map(f => <p key={f.id}>확인 필요 · {f.name}: {f.note || "금액과 실행 조건을 확인해 주세요."}</p>)}
      </div></div>
      {edit && <form ref={editor} key={`${edit.section}-${edit.row.id ?? "settings"}`} className="panel purchase-editor" aria-label={`${sectionNames[edit.section]} 편집`}
        onSubmit={e => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}>
        <h3>{sectionNames[edit.section]} 편집</h3><p className="muted">금액을 비워두면 미입력, 0을 입력하면 확정 0원입니다. 저장하면 기존 시뮬레이션은 초기화됩니다.</p>
        <div className="purchase-fields">{fields[edit.section].map(field => <label key={field.key}>{field.label}
          {field.options ? <select aria-label={field.label} name={field.key} defaultValue={String(edit.row[field.key])}>{field.options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
            : field.type === "checkbox" ? <input aria-label={field.label} name={field.key} type="checkbox" defaultChecked={Boolean(edit.row[field.key])} />
            : <input aria-label={field.label} name={field.key} type={field.type ?? "text"} required={field.required} maxLength={field.maxLength ?? 80}
              min={field.key === "months" ? 1 : field.type === "number" ? 0 : undefined}
              max={field.key === "months" ? 120 : field.key === "apr" ? 100 : field.type === "number" ? Number.MAX_SAFE_INTEGER : undefined}
              step={field.step ?? "1"} defaultValue={String(edit.row[field.key] ?? "")} />}
        </label>)}</div>
        {edit.section === "payments" && <p className="muted">일부 납부/납부 완료는 실제 금액과 날짜가 필요합니다. 미확인/예정은 실제 기록을 비워두세요. 세금은 매매 설정에서 별도 기록합니다.</p>}
        <div className="purchase-actions"><button type="button" className="secondary" onClick={() => setEdit(null)}>취소</button><button className="primary" disabled={disabled}>기록 저장</button></div>
      </form>}
      <Records title="납부 일정" onAdd={() => begin("payments")} disabled={disabled}
        headings={["항목", "예정일", "예정금액", "실제 납부일", "실제 납부금액", "상태"]}
        rows={value.payments.map(r => ({ id: r.id, cells: [r.name, r.dueDate ?? "미입력", amount(r.amount), r.actualDate ?? "미입력", amount(r.actualAmount), statuses[r.status]] }))}
        onEdit={id => begin("payments", value.payments.find(r => r.id === id))} onDelete={id => remove("payments", id)} />
      <p className="muted">세금은 위 일정과 별도입니다. 세금 실제 납부 누계: {amount(value.tax.actualAmount)} · 최근 납부일: {value.tax.actualDate ?? "미입력"}</p>
      <Records title="재원 관리" onAdd={() => begin("funding")} disabled={disabled}
        headings={["명의", "항목", "용도", "한도 (참고)", "예상 투입", "실제 확보", "확보일", "금리", "메모"]}
        rows={value.funding.map(r => ({ id: r.id, cells: [r.owner || "미입력", r.name, r.purpose === "repayment" ? "상환용·합계 제외" : r.loan ? "대출" : "매매", amount(r.limit), amount(r.expected), amount(r.actual), r.securedDate ?? "미입력", r.apr === null ? "미입력" : `${r.apr}%`, `${r.needsReview ? "확인 필요 · " : ""}${r.note}${r.gross === null ? "" : ` (세전 ${won(r.gross)})`}`] }))}
        onEdit={id => begin("funding", value.funding.find(r => r.id === id))} onDelete={id => remove("funding", id)} />
      <Records title="매매 예산" onAdd={() => begin("costs")} disabled={disabled} headings={["항목", "유형", "예상금액"]}
        rows={value.costs.map(r => ({ id: r.id, cells: [r.name, { price: "매매대금", fee: "부대비용", tax: "세금" }[r.kind], amount(r.amount)] }))}
        onEdit={id => begin("costs", value.costs.find(r => r.id === id))} onDelete={id => remove("costs", id)} />
      <div className="panel-heading"><div><h2>시뮬레이션</h2><p>실제 기록과 기본 계획을 변경하지 않고 비교합니다. 금리는 이자만 납부하는 가정입니다.</p></div>
        <button className="primary" disabled={disabled} onClick={() => setSimulating(!simulating)}>{simulating ? "시뮬레이션 닫기" : "시뮬레이션 열기"}</button></div>
      {simulating && <Simulation key={JSON.stringify(value)} value={value} disabled={disabled} onSave={s => save({ ...value, scenario: s })} />}
    </>}
  </section>;
}
function Records({ title, headings, rows, disabled, onAdd, onEdit, onDelete }: {
  title: string; headings: string[]; rows: { id: string; cells: string[] }[]; disabled: boolean;
  onAdd: () => void; onEdit: (id: string) => void; onDelete: (id: string) => void;
}) {
  return <section className="panel purchase-records"><div className="panel-heading"><h2>{title}</h2><button className="text-button" disabled={disabled} onClick={onAdd}>＋ {title} 추가</button></div>
    {rows.length ? <div className="table-wrap"><table><thead><tr>{headings.map(h => <th key={h} scope="col">{h}</th>)}<th scope="col">관리</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}<td><div className="row-actions">
        <button disabled={disabled} aria-label={`${row.cells[title === "재원 관리" ? 1 : 0]} 수정`} onClick={() => onEdit(row.id)}>수정</button>
        <button disabled={disabled} aria-label={`${row.cells[title === "재원 관리" ? 1 : 0]} 삭제`} onClick={() => onDelete(row.id)}>삭제</button>
      </div></td></tr>)}</tbody></table></div> : <div className="asset-empty">아직 등록한 기록이 없습니다.</div>}
  </section>;
}
function NumberField({ label, value, onChange, rate = false }: { label: string; value: Money; onChange: (n: Money) => void; rate?: boolean }) {
  return <label>{label}<input type="number" min="0" max={rate ? 100 : Number.MAX_SAFE_INTEGER} step={rate ? "0.001" : "1"}
    value={value ?? ""} placeholder="미입력" onChange={e => {
      if (!e.target.value) return onChange(null);
      const n = Number(e.target.value);
      if (Number.isFinite(n) && n >= 0 && (rate ? n <= 100 : Number.isSafeInteger(n))) onChange(n);
    }} /></label>;
}
function Simulation({ value, onSave, disabled }: { value: Purchase; onSave: (s: Scenario) => boolean; disabled: boolean }) {
  const [draft, setDraft] = useState<Scenario>(() => structuredClone(value.scenario ?? createScenario(value)));
  const [message, setMessage] = useState("");
  let result: ReturnType<typeof purchaseSummary> | null = null;
  try { validatePurchase({ ...value, scenario: draft }); result = purchaseSummary(value, draft); } catch { /* Show validation error without touching saved data. */ }
  function funding(id: string, key: "amount" | "apr", v: Money) {
    setDraft(d => ({ ...d, funding: d.funding.map(r => r.id === id ? { ...r, [key]: v } : r) }));
  }
  return <section className="panel purchase-editor" aria-label="시뮬레이션">
    <h3>가정 변경 · {value.scenario ? "저장된 시나리오" : "기본 계획에서 시작"}</h3>
    <div className="purchase-fields">
      {value.funding.filter(f => f.purpose === "purchase").map(f => <div key={f.id}>
        <NumberField label={`${f.name} 예상 투입 (원)`} value={draft.funding.find(r => r.id === f.id)?.amount ?? null} onChange={v => funding(f.id, "amount", v)} />
        {f.loan && <NumberField label={`${f.name} 연 금리 (%)`} rate value={draft.funding.find(r => r.id === f.id)?.apr ?? null} onChange={v => funding(f.id, "apr", v)} />}</div>)}
      {value.costs.map(c => <NumberField key={c.id} label={`${c.name} 가정 (원)`} value={draft.costs.find(r => r.id === c.id)?.amount ?? null}
        onChange={v => setDraft(d => ({ ...d, costs: d.costs.map(r => r.id === c.id ? { ...r, amount: v } : r) }))} />)}
      <label>세금 납부방식<select value={draft.taxMode} onChange={e => setDraft(d => ({ ...d, taxMode: e.target.value as Scenario["taxMode"] }))}><option value="cash">일시납</option><option value="card">카드 할부</option></select></label>
      <label>할부 개월<input type="number" min="1" max="120" step="1" value={draft.months} onChange={e => {
        const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 120) setDraft(d => ({ ...d, months: n }));
      }} /></label>
      <NumberField label="총 할부수수료 (원)" value={draft.fee} onChange={v => setDraft(d => ({ ...d, fee: v }))} />
    </div>
    {result ? <div className="tip"><div><strong>예상 잔액: {result.balance === null ? "기납부 기준 미확인" : won(result.balance)}</strong>
      <p>기납부 후 기준 {won(result.afterPaid)} / 포함 기준 {won(result.includesPaid)}. 세금 전체를 반영한 잔액이며 카드 납부로 비용이 줄어들지 않습니다.</p>
      <p>필요금액과 잔액에는 입력한 카드 할부수수료가 포함됩니다.{result.unknownFee ? " 수수료 미입력으로 잠정값입니다." : ""}</p>
      <p>세금 납부 시점 이연 후 가용액: {result.immediateBalance === null ? "기준 미확인" : won(result.immediateBalance)} (할부 상환액 별도 확보 필요)</p>
      <p>월 부담 (입력분): {won(Math.round(result.monthly))} = 대출 이자 {won(Math.round(result.interest))} + 세금 원금 {won(Math.round(result.cardPrincipal))} + 평균 수수료 {won(Math.round(result.cardFee))}</p>
      <p>대출 원금 상환·생활비는 포함하지 않습니다. 할부 원금/수수료는 남은 세금을 기간으로 나눈 평균값으로, 실제 청구액·면제 조건은 카드사 확인이 필요합니다.</p>
      {(result.unknownInterest || result.unknownFee || result.provisional) && <p>금액·금리·수수료 또는 확인 필요 항목이 있어 추정치는 미완성입니다.</p>}
      <p>납부 조건 메모 (미확정): {value.tax.note || "미입력"}</p>
    </div></div> : <p role="alert">대출 한도 또는 금액 합계를 확인해 주세요. 이 가정은 저장할 수 없습니다.</p>}
    <div className="purchase-actions"><button className="secondary" onClick={() => { setDraft(createScenario(value)); setMessage("기본 계획으로 가정을 초기화했습니다. 저장 전까지 기존 시나리오는 유지됩니다."); }}>기본 계획으로 초기화</button>
      <button className="primary" disabled={disabled || !result} onClick={() => { if (onSave(draft)) setMessage("시나리오를 저장했습니다."); }}>시나리오 저장</button></div><p role="status">{message}</p>
  </section>;
}

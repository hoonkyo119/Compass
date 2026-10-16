"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  assetLabels,
  assetSummary,
  monthlySummary,
  parseData,
  storageKey,
  validAmount,
  won,
  type Asset,
  type AssetKind,
  type FinanceData,
  type Transaction,
} from "@/lib/finance";

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
const empty: FinanceData = { transactions: [], assets: [] };

export default function Dashboard() {
  const [data, setData] = useState<FinanceData>(empty);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"present" | "future">("present");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<"transaction" | "asset" | null>(null);
  const [editing, setEditing] = useState<Transaction | Asset | null>(null);
  const [error, setError] = useState("");
  const modal = useRef<HTMLDialogElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    // Read browser-only storage after hydration, keeping server/client markup identical.
    queueMicrotask(() => {
      if (cancelled) return;
      setMonth(localDate().slice(0, 7));
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setData(parseData(saved));
      } catch {
        setMessage(
          "저장 데이터를 읽을 수 없습니다. 원본 보호를 위해 자동 저장을 중단했습니다. 백업 파일을 가져오거나 브라우저 저장소를 확인해 주세요.",
        );
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    modal.current?.showModal();
  }, [dialog]);

  function persist(next: FinanceData) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setData(next);
      setReady(true);
      setMessage("저장했습니다.");
      return true;
    } catch {
      setMessage(
        "저장 공간이 부족하거나 브라우저 저장이 차단되어 있습니다. 백업을 내보낸 후 다시 시도해 주세요.",
      );
      return false;
    }
  }
  function open(
    kind: "transaction" | "asset",
    row: Transaction | Asset | null = null,
  ) {
    setEditing(row);
    setError("");
    setDialog(kind);
  }
  function close() {
    modal.current?.close();
    setDialog(null);
    setEditing(null);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!validAmount(amount)) {
      setError("금액은 1원 이상의 안전한 정수로 입력해 주세요.");
      return;
    }
    const id = editing?.id || crypto.randomUUID();
    let next: FinanceData;
    if (dialog === "transaction") {
      const row: Transaction = {
        id,
        amount,
        date: String(form.get("date")),
        type: form.get("type") as Transaction["type"],
        title: String(form.get("title")).trim(),
        category: String(form.get("category")).trim(),
      };
      if (!row.title || !row.category) {
        setError("내용과 분류를 입력해 주세요.");
        return;
      }
      next = {
        ...data,
        transactions: [
          ...data.transactions.filter((item) => item.id !== id),
          row,
        ],
      };
    } else {
      const row: Asset = {
        id,
        amount,
        kind: form.get("kind") as AssetKind,
        name: String(form.get("name")).trim(),
        note: String(form.get("note")).trim(),
      };
      if (!row.name) {
        setError("자산명을 입력해 주세요.");
        return;
      }
      next = {
        ...data,
        assets: [...data.assets.filter((item) => item.id !== id), row],
      };
    }
    try {
      parseData(JSON.stringify(next));
    } catch {
      setError("입력한 날짜와 내용을 확인해 주세요.");
      return;
    }
    if (persist(next)) close();
  }
  function remove(kind: "transaction" | "asset", id: string) {
    if (!window.confirm("이 내역을 삭제할까요? 삭제 후 되돌릴 수 없습니다."))
      return;
    persist(
      kind === "transaction"
        ? {
            ...data,
            transactions: data.transactions.filter((row) => row.id !== id),
          }
        : { ...data, assets: data.assets.filter((row) => row.id !== id) },
    );
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `compass-${localDate()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importData(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("5MB 이하 파일만 가져올 수 있습니다.");
      const next = parseData(await file.text());
      if (
        window.confirm(
          "백업 내용으로 현재 데이터를 교체할까요? 기존 데이터는 먼저 내보내기를 권장합니다.",
        )
      )
        persist(next);
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "백업을 읽지 못했습니다.",
      );
    }
  }
  const current = monthlySummary(data.transactions, month);
  const wealth = assetSummary(data.assets);
  const rows = current.rows
    .filter((row) => filter === "all" || row.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const categories = current.rows
    .filter((row) => row.type === "expense")
    .reduce<Record<string, number>>((result, row) => {
      result[row.category] = (result[row.category] ?? 0) + row.amount;
      return result;
    }, {});
  const transaction = editing && "date" in editing ? editing : null;
  const asset = editing && "kind" in editing ? editing : null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Compass 홈">
          <span className="brand-mark">✦</span> compass
          <span className="version">v0.1</span>
        </Link>
        <div className="workspace-label">MY WORKSPACE</div>
        <nav aria-label="주요 메뉴">
          <button
            className={tab === "present" ? "nav-item active" : "nav-item"}
            onClick={() => setTab("present")}
            aria-pressed={tab === "present"}
          >
            <span>◷</span> 현재 <small>오늘의 기록</small>
          </button>
          <button
            className={tab === "future" ? "nav-item active" : "nav-item"}
            onClick={() => setTab("future")}
            aria-pressed={tab === "future"}
          >
            <span>↗</span> 미래 <small>내일의 자산</small>
          </button>
        </nav>
        <div className="sidebar-note">
          <span>
            작은 기록이 만드는
            <br />더 나은 내일.
          </span>
          <p>나만의 속도로, 나만의 방향으로.</p>
          <div className="compass-art">✦</div>
        </div>
        <div className="local-label">
          <i /> 이 브라우저에만 보관
          <br />
          <small>동기화되지 않으니 백업을 보관하세요.</small>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            나의 재무 워크스페이스{" "}
            <span className="breadcrumb">
              / {tab === "present" ? "현재" : "미래"}
            </span>
          </span>
          <span className="profile">나</span>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR FINANCIAL COMPASS</div>
              <h1>
                {tab === "present"
                  ? "오늘을 기록하고, 내일을 준비해요."
                  : "차곡차곡, 나의 미래를 그려요."}
              </h1>
              <p>
                {tab === "present"
                  ? "나의 돈이 어디에서 와서 어디로 가는지, 한눈에 살펴보세요."
                  : "자산과 대출을 함께 살펴보고 나만의 재무 방향을 정하세요."}
              </p>
            </div>
            <button
              className="primary"
              disabled={!ready}
              onClick={() => open(tab === "present" ? "transaction" : "asset")}
            >
              ＋ {tab === "present" ? "내역 추가" : "자산 추가"}
            </button>
          </div>
          <div className="view-toolbar">
            <div className="segmented" aria-label="재무 보기">
              <button
                className={tab === "present" ? "selected" : ""}
                onClick={() => setTab("present")}
                aria-pressed={tab === "present"}
              >
                현재
              </button>
              <button
                className={tab === "future" ? "selected" : ""}
                onClick={() => setTab("future")}
                aria-pressed={tab === "future"}
              >
                미래
              </button>
            </div>
            {tab === "present" ? (
              <label className="month-picker">
                조회 월{" "}
                <input
                  aria-label="조회 월"
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  required
                />
              </label>
            ) : (
              <span className="muted">직접 등록한 현재 평가액 기준</span>
            )}
          </div>
          <div role="status" className="status">
            {message || (!ready ? "데이터를 불러오는 중입니다…" : "")}
          </div>
          {tab === "present" ? (
            <>
              <section className="summary-grid" aria-label="월별 요약">
                <Summary
                  label="이번 달 수입"
                  amount={current.income}
                  tone="green"
                  icon="↙"
                  detail="들어온 돈"
                />
                <Summary
                  label="이번 달 지출"
                  amount={current.expense}
                  tone="orange"
                  icon="↗"
                  detail="사용한 돈"
                />
                <Summary
                  label="이번 달 잔액"
                  amount={current.balance}
                  tone="dark"
                  icon="＝"
                  detail="수입 − 지출"
                />
              </section>
              <div className="detail-grid">
                <section className="panel ledger">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        수입 · 지출 내역{" "}
                        <span className="count">{current.rows.length}</span>
                      </h2>
                      <p>하루하루 쌓이는 나의 금융 기록</p>
                    </div>
                    <select
                      aria-label="내역 유형 필터"
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                    >
                      <option value="all">전체 내역</option>
                      <option value="income">수입</option>
                      <option value="expense">지출</option>
                    </select>
                  </div>
                  {rows.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>내역 / 날짜</th>
                            <th>분류</th>
                            <th className="align-right">금액</th>
                            <th>관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id}>
                              <td>
                                <strong>{row.title}</strong>
                                <small>{row.date}</small>
                              </td>
                              <td>
                                <span className="badge">{row.category}</span>
                              </td>
                              <td
                                className={`align-right amount ${row.type === "income" ? "positive" : ""}`}
                              >
                                {row.type === "income" ? "+" : "−"}
                                {won(row.amount)}
                                <small>
                                  {row.type === "income" ? "수입" : "지출"}
                                </small>
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    aria-label={`${row.title} 수정`}
                                    onClick={() => open("transaction", row)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    aria-label={`${row.title} 삭제`}
                                    onClick={() =>
                                      remove("transaction", row.id)
                                    }
                                  >
                                    삭제
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty">
                      <span>＋</span>
                      <h3>기록의 첫 페이지를 열어보세요</h3>
                      <p>선택한 월과 필터에 맞는 내역이 없습니다.</p>
                      <button
                        className="text-button"
                        disabled={!ready}
                        onClick={() => open("transaction")}
                      >
                        첫 내역 추가하기 ↗
                      </button>
                    </div>
                  )}
                </section>
                <section className="panel spending">
                  <div className="panel-heading">
                    <div>
                      <h2>어디에 사용했을까요?</h2>
                      <p>분류별 지출 비중</p>
                    </div>
                  </div>
                  {current.expense ? (
                    <>
                      <div className="spending-total">
                        <small>총 지출</small>
                        <strong>{won(current.expense)}</strong>
                      </div>
                      <div className="category-list">
                        {Object.entries(categories)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, amount]) => (
                            <div key={name}>
                              <div className="category-label">
                                <span>{name}</span>
                                <strong>
                                  {Math.round((amount / current.expense) * 100)}
                                  %
                                </strong>
                              </div>
                              <div className="progress">
                                <div
                                  style={{
                                    width: `${(amount / current.expense) * 100}%`,
                                  }}
                                />
                              </div>
                              <small>{won(amount)}</small>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty small-empty">
                      <div className="empty-ring" />
                      <p>
                        지출을 기록하면
                        <br />
                        소비 패턴을 확인할 수 있어요.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <section className="summary-grid" aria-label="자산 요약">
                <Summary
                  label="총 자산"
                  amount={wealth.total}
                  tone="green"
                  icon="↗"
                  detail="부동산 + 주식 + 저축"
                />
                <Summary
                  label="남은 대출"
                  amount={wealth.debt}
                  tone="orange"
                  icon="↘"
                  detail="상환해야 할 원금"
                />
                <Summary
                  label="나의 순자산"
                  amount={wealth.net}
                  tone="dark"
                  icon="✦"
                  detail="총 자산 − 남은 대출"
                />
              </section>
              <div className="asset-grid">
                {(Object.keys(assetLabels) as AssetKind[]).map((kind) => {
                  const items = data.assets.filter((row) => row.kind === kind);
                  return (
                    <section className="panel asset-panel" key={kind}>
                      <div className="panel-heading">
                        <div>
                          <h2>
                            <span className="asset-icon">
                              {
                                {
                                  realestate: "⌂",
                                  stock: "↗",
                                  saving: "◉",
                                  loan: "⇄",
                                }[kind]
                              }
                            </span>{" "}
                            {assetLabels[kind]}{" "}
                            <span className="count">{items.length}</span>
                          </h2>
                          <p>
                            {won(
                              items.reduce((sum, row) => sum + row.amount, 0),
                            )}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          disabled={!ready}
                          onClick={() =>
                            open("asset", {
                              id: "",
                              kind,
                              name: "",
                              amount: 0,
                              note: "",
                            })
                          }
                        >
                          ＋ 추가
                        </button>
                      </div>
                      {items.length ? (
                        <ul className="asset-list">
                          {items.map((row) => (
                            <li key={row.id}>
                              <div>
                                <strong>{row.name}</strong>
                                <small>{row.note || "메모 없음"}</small>
                              </div>
                              <div className="asset-value">
                                <strong>{won(row.amount)}</strong>
                                <div className="row-actions">
                                  <button
                                    onClick={() => open("asset", row)}
                                    aria-label={`${row.name} 수정`}
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => remove("asset", row.id)}
                                    aria-label={`${row.name} 삭제`}
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="asset-empty">
                          등록한 {assetLabels[kind]} 내역이 없습니다.
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
          <section className="tip">
            <span className="tip-icon">✦</span>
            <div>
              <strong>
                {tab === "present"
                  ? "꾸준한 기록이 좋은 습관의 시작이에요."
                  : "자산의 변화도 주기적으로 기록해 보세요."}
              </strong>
              <p>
                {tab === "present"
                  ? "작은 지출 하나부터 시작해 보세요. 나의 소비 흐름이 조금씩 보이기 시작할 거예요."
                  : "평가액과 대출 잔액은 직접 수정할 수 있어요. 시세나 이자가 자동 반영되지는 않습니다."}
              </p>
            </div>
          </section>
          <footer>
            <span>
              COMPASS <span className="footer-dot">·</span> 오늘의 기록, 내일의
              방향
            </span>
            <div>
              <button onClick={exportData} disabled={!ready}>
                백업 내보내기
              </button>
              <button onClick={() => importInput.current?.click()}>
                백업 가져오기
              </button>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={importData}
              />
            </div>
          </footer>
        </div>
      </main>
      {dialog && (
        <dialog
          ref={modal}
          onCancel={close}
          onClose={() => setDialog(null)}
          aria-labelledby="dialog-title"
        >
          <form onSubmit={submit}>
            <div className="dialog-heading">
              <h2 id="dialog-title">
                {editing?.id
                  ? "내역 수정"
                  : dialog === "transaction"
                    ? "수입 · 지출 추가"
                    : "자산 · 대출 추가"}
              </h2>
              <button type="button" onClick={close} aria-label="닫기">
                ×
              </button>
            </div>
            <p className="muted">금액은 원 단위로 입력해 주세요.</p>
            {dialog === "transaction" ? (
              <>
                <label>
                  유형
                  <select
                    aria-label="유형"
                    name="type"
                    defaultValue={transaction?.type ?? "expense"}
                  >
                    <option value="expense">지출</option>
                    <option value="income">수입</option>
                  </select>
                </label>
                <label>
                  날짜
                  <input
                    aria-label="날짜"
                    name="date"
                    type="date"
                    required
                    defaultValue={transaction?.date ?? localDate()}
                  />
                </label>
                <label>
                  내용
                  <input
                    aria-label="내용"
                    name="title"
                    required
                    maxLength={80}
                    placeholder="예: 점심 식사, 월급"
                    defaultValue={transaction?.title}
                  />
                </label>
                <label>
                  분류
                  <input
                    aria-label="분류"
                    name="category"
                    required
                    maxLength={30}
                    list="categories"
                    placeholder="예: 식비, 교통, 급여"
                    defaultValue={transaction?.category}
                  />
                  <datalist id="categories">
                    {[
                      "식비",
                      "교통",
                      "쇼핑",
                      "주거",
                      "건강",
                      "문화",
                      "급여",
                      "부수입",
                      "기타",
                    ].map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>
              </>
            ) : (
              <>
                <label>
                  자산 유형
                  <select
                    aria-label="자산 유형"
                    name="kind"
                    defaultValue={asset?.kind ?? "saving"}
                  >
                    {Object.entries(assetLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  자산명
                  <input
                    aria-label="자산명"
                    name="name"
                    required
                    maxLength={80}
                    placeholder="예: 주택청약, 주택담보대출"
                    defaultValue={asset?.name}
                  />
                </label>
                <label>
                  메모
                  <input
                    aria-label="메모"
                    name="note"
                    maxLength={200}
                    placeholder="예: 만기일, 보유 수량, 금리"
                    defaultValue={asset?.note}
                  />
                </label>
              </>
            )}
            <label>
              {dialog === "asset" ? "현재 평가액 / 남은 대출 원금" : "금액"}
              <div className="money-input">
                <input
                  aria-label={
                    dialog === "asset" ? "현재 평가액 / 남은 대출 원금" : "금액"
                  }
                  name="amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={Number.MAX_SAFE_INTEGER}
                  step="1"
                  required
                  defaultValue={editing?.amount || ""}
                />
                <span>원</span>
              </div>
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={close}>
                취소
              </button>
              <button className="primary" type="submit">
                저장하기
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
function Summary({
  label,
  amount,
  tone,
  icon,
  detail,
}: {
  label: string;
  amount: number;
  tone: string;
  icon: string;
  detail: string;
}) {
  return (
    <article className={`summary ${tone}`}>
      <div className="summary-top">
        <span>{label}</span>
        <span className="summary-icon">{icon}</span>
      </div>
      <strong>{won(amount)}</strong>
      <small>{detail}</small>
    </article>
  );
}

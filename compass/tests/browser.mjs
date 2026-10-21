const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.COMPASS_BASE_URL || "http://127.0.0.1:3101");
  await page
    .getByRole("button", { name: "＋ 내역 추가", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".page-heading button").disabled,
  );
  async function entry(title, type, amount, date) {
    await page
      .getByRole("button", { name: "＋ 내역 추가", exact: true })
      .click();
    await page.getByLabel("유형", { exact: true }).selectOption(type);
    if (date) await page.getByLabel("날짜", { exact: true }).fill(date);
    await page.getByLabel("내용", { exact: true }).fill(title);
    await page
      .getByLabel("분류", { exact: true })
      .fill(type === "income" ? "급여" : "식비");
    await page.getByLabel("금액", { exact: true }).fill(String(amount));
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
  }
  await entry("월급 테스트", "income", 3000000);
  await entry("점심 테스트", "expense", 12000);
  assert.match(await page.locator(".summary-grid").innerText(), /2,988,000/);
  await page
    .getByRole("button", { name: "점심 테스트 수정", exact: true })
    .click();
  await page.getByLabel("금액", { exact: true }).fill("15000");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  assert.match(await page.locator(".summary-grid").innerText(), /2,985,000/);
  await page.getByLabel("내역 유형 필터").selectOption("expense");
  assert.equal(await page.locator("tbody tr").count(), 1);
  await page.getByLabel("내역 유형 필터").selectOption("all");
  const month = await page.getByLabel("조회 월", { exact: true }).inputValue();
  await page.getByLabel("조회 월", { exact: true }).fill("2020-01");
  assert.equal(await page.locator("tbody tr").count(), 0);
  await page.getByLabel("조회 월", { exact: true }).fill(month);
  await page.screenshot({ path: "/tmp/compass-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "미래", exact: true }).click();
  for (const [kind, name, amount] of [
    ["realestate", "우리집", 200000000],
    ["stock", "주식계좌", 500000],
    ["saving", "적금", 1000000],
    ["loan", "주택대출", 100000000],
  ]) {
    await page
      .getByRole("button", { name: "＋ 자산 추가", exact: true })
      .click();
    await page.getByLabel("자산 유형", { exact: true }).selectOption(kind);
    await page.getByLabel("자산명", { exact: true }).fill(name);
    await page
      .getByLabel("현재 평가액 / 남은 대출 원금", { exact: true })
      .fill(String(amount));
    await page.getByRole("button", { name: "저장하기", exact: true }).click();
  }
  assert.match(await page.locator(".summary-grid").innerText(), /101,500,000/);
  await page
    .locator(".asset-panel")
    .filter({ has: page.getByRole("heading", { name: /저축/ }) })
    .getByRole("button", { name: "＋ 추가", exact: true })
    .click();
  await page.getByLabel("자산명", { exact: true }).fill("추가저축");
  await page
    .getByLabel("현재 평가액 / 남은 대출 원금", { exact: true })
    .fill("100");
  await page.getByRole("button", { name: "저장하기", exact: true }).click();
  assert.equal(await page.locator(".asset-list li").count(), 5);
  await page.reload();
  await page.waitForFunction(
    () => !document.querySelector(".page-heading button").disabled,
  );
  await page.getByRole("button", { name: "미래", exact: true }).click();
  assert.equal(await page.locator(".asset-list li").count(), 5);
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow ${width}`,
    );
    await page.screenshot({
      path: `/tmp/compass-${width}.png`,
      fullPage: true,
    });
  }
  const saved = await page.evaluate(() => localStorage.getItem("compass-v0.1"));
  assert.equal(JSON.parse(saved).transactions.length, 2);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "백업 내보내기" }).click();
  const download = await downloadPromise;
  await download.saveAs("/tmp/compass-backup.json");
  assert.deepEqual(
    JSON.parse(readFileSync("/tmp/compass-backup.json", "utf8")),
    JSON.parse(saved),
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "추가저축 삭제", exact: true })
    .click();
  assert.equal(await page.locator(".asset-list li").count(), 4);
  page.once("dialog", (d) => d.accept());
  await page
    .locator("footer input[type=file]")
    .setInputFiles("/tmp/compass-backup.json");
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem("compass-v0.1")).assets.length === 5,
  );
  await page
    .locator("footer input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{}"),
    });
  await page
    .getByRole("status")
    .filter({ hasText: "지원하지 않는 백업 형식" })
    .waitFor();
  assert.equal(
    JSON.parse(await page.evaluate(() => localStorage.getItem("compass-v0.1")))
      .assets.length,
    5,
  );
  await page.evaluate(() => localStorage.setItem("compass-v0.1", "broken"));
  await page.reload();
  await page.getByRole("status").filter({ hasText: "원본 보호" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "＋ 내역 추가", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("compass-v0.1")),
    "broken",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: transaction CRUD, monthly filters/totals, four asset types, category add, persistence, backup roundtrip, corrupt backup/storage protection, mobile/tablet overflow, no browser errors",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});


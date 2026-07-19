import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const baseURL = process.env.BASE_URL || "http://localhost:3000";
const outputDir = "screenshots";

await mkdir(outputDir, { recursive: true });
const systemChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch(existsSync(systemChrome) ? { executablePath: systemChrome } : {});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

async function setIdentity(role, supplierPartyId = "party-a") {
  await page.evaluate(({ nextRole, partyId }) => {
    window.localStorage.setItem("demo-role", nextRole);
    window.localStorage.setItem("demo-supplier-party", partyId);
  }, { nextRole: role, partyId: supplierPartyId });
}

async function open(path, role = "store", supplierPartyId = "party-a") {
  await setIdentity(role, supplierPartyId);
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(450);
}

async function capture(name, path, role, options = {}) {
  await open(path, role, options.supplierPartyId);
  if (options.locator) {
    await page.locator(options.locator).screenshot({ path: `${outputDir}/${name}.png` });
  } else {
    await page.screenshot({ path: `${outputDir}/${name}.png`, fullPage: true });
  }
}

await page.goto(baseURL, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
});

await capture("demo-control", "/admin/demo-control", "admin");
await capture("store-report", "/store/report", "store");
await capture("ai-analysis", "/orders/order-001", "store", { locator: ".decision-grid" });
await capture("manager-review", "/orders/order-003", "manager");
await capture("supplier-task", "/supplier", "supplier", { supplierPartyId: "party-a" });
await capture("order-timeline", "/orders/order-001", "manager", { locator: ".detail-columns" });
await capture("acceptance", "/orders/order-007", "store");
await capture("operations-dashboard", "/admin", "admin");
await capture("asset-history", "/assets/asset-gel-001", "store");

await page.evaluate(async () => {
  await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "timeout", orderId: "order-004" }),
  });
});
await capture("sla-timeout", "/orders/order-004", "manager");

await page.setViewportSize({ width: 390, height: 844 });
await capture("mobile-store-report", "/store/report", "store");
await capture("mobile-acceptance", "/orders/order-007", "store");

await page.evaluate(async () => {
  await fetch("/api/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
});

await browser.close();
console.log(`已保存 12 张验收截图到 ${outputDir}/，包含 10 张演示截图和 2 张移动端 QA 截图。`);

import { expect, test, type Page } from "@playwright/test";

const walletAddress = "0x1111111111111111111111111111111111111111";

async function installWallet(page: Page, chainId = "0xf22d") {
  await page.addInitScript(({ address, initialChainId }) => {
    let currentChainId = initialChainId;
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    const provider = {
      isMetaMask: true,
      request: async ({ method }: { method: string }) => {
        if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
        if (method === "eth_chainId") return currentChainId;
        if (method === "wallet_switchEthereumChain") {
          currentChainId = "0xf22d";
          for (const listener of listeners.get("chainChanged") ?? []) listener(currentChainId);
          return null;
        }
        if (method === "wallet_addEthereumChain") return null;
        if (method === "wallet_requestPermissions") return null;
        return null;
      },
      on: (event: string, handler: (...args: unknown[]) => void) => {
        const handlers = listeners.get(event) ?? new Set();
        handlers.add(handler);
        listeners.set(event, handlers);
      },
      removeListener: (event: string, handler: (...args: unknown[]) => void) => listeners.get(event)?.delete(handler),
    };
    window.ethereum = provider;
  }, { address: walletAddress, initialChainId: chainId });
}

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, "horizontal overflow").toBe(false);
}

test("all release routes render without runtime errors or overflow", async ({ page }, testInfo) => {
  const errors = await collectRuntimeErrors(page);
  const routes = [
    "/",
    "/app",
    "/app/explore",
    "/app/create",
    "/app/activity",
    "/transparency",
    "/app/commitments/fixture-commitment",
    `/app/profile/${walletAddress}`,
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("body")).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll("/", "_") || "landing"}.png`), fullPage: true });
  }

  expect(errors, errors.join("\n")).toEqual([]);
});

test("disconnected, connected, wrong-network, and Studio-dev states are explicit", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText("Connect wallet").first()).toBeVisible();
  await expect(page.getByText("GenLayer Studio-dev").first()).toBeVisible();

  await installWallet(page);
  await page.reload();
  await expect(page.getByText("Connected wallet")).toBeVisible();
  await expect(page.getByText("GenLayer Studio-dev").first()).toBeVisible();

  await installWallet(page, "0x1");
  await page.goto("/app");
  await expect(page.locator(".network-switch").first()).toBeVisible();
  await page.locator(".network-switch:visible").first().evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByText("Connected wallet")).toBeVisible();
  await expect(page.getByText("GenLayer Studio-dev").first()).toBeVisible();
});

async function fillCreateForm(page: Page) {
  await page.goto("/app/create");
  await page.getByLabel("Title").fill("Monthly transparency report");
  await page.getByLabel("Category").fill("Public accountability");
  await page.getByLabel("Published source URL").fill("https://example.com/commitment");
  await page.getByLabel("Exact commitment text").fill("I will publish a monthly transparency report every month.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Beneficiary wallet").fill("0x2222222222222222222222222222222222222222");
  await page.getByLabel("GEN stake").fill("100");
  await page.getByLabel("Expiry").fill("2027-09-01T00:00");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create commitment" }).click();
}

test("create flow parses GEN, quotes developer profile, and persists a final transaction id", async ({ page }) => {
  await installWallet(page);
  await fillCreateForm(page);
  await expect(page.getByText("Estimated protocol fee deposit")).toBeVisible();
  await expect(page.getByText("Developer/measured profile")).toBeVisible();
  await expect(page.getByText("100 GEN", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Review & sign" }).click();
  await expect(page.getByText(/Transaction 0xe2e00000/)).toBeVisible();
  await expect(page.getByText("State confirmed")).toBeVisible();
});

test("Transaction Kit network fallback is visible and pending transactions reconcile by id", async ({ page }) => {
  await installWallet(page);
  await page.addInitScript(() => localStorage.setItem("uphold.e2e.fee-source", "network"));
  await fillCreateForm(page);
  await expect(page.getByText("Network defaults")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.addInitScript(() => {
    localStorage.setItem("uphold.pending-transactions.v1", JSON.stringify([{
      id: "0xe2e0000000000000000000000000000000000000000000000000000000000001",
      genlayerTxId: "0xe2e0000000000000000000000000000000000000000000000000000000000001",
      method: "create_commitment",
      commitmentId: "fixture-commitment",
      stateExpectation: { currentStake: "100000000000000000000" },
      createdAt: "2026-09-01T00:00:00Z",
    }]));
  });
  await page.reload();
  await expect(page.getByText("Pending transaction needs reconciliation")).toBeVisible();
  await page.getByRole("button", { name: "Reconcile" }).click();
  await expect(page.getByText("Pending transaction needs reconciliation")).toBeHidden();
});

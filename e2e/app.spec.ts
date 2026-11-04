import { test, expect, type Page } from "@playwright/test";
type Row = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
};
const uid = "11111111-1111-4111-8111-111111111111";
const user = {
  id: uid,
  aud: "authenticated",
  role: "authenticated",
  email: "tester@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const token = {
  access_token: "test-token",
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
};
async function api(
  page: Page,
  { confirmation = false, failSave = false } = {},
) {
  const rows: Row[] = [];
  let writes = 0;
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body: unknown = {};
    if (url.pathname.endsWith("/token")) body = token;
    else if (url.pathname.endsWith("/signup"))
      body = confirmation ? { user, session: null } : token;
    else if (url.pathname.endsWith("/user")) body = user;
    else if (url.pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
      return;
    } else if (url.pathname.includes("/rest/v1/requests")) {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      if (req.method() === "POST") {
        writes++;
        await new Promise((r) => setTimeout(r, 150));
        if (failSave) {
          await route.abort("failed");
          return;
        }
        const values = req.postDataJSON();
        const row = {
          ...values,
          id: crypto.randomUUID(),
          user_id: uid,
          status: "Новая",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        rows.unshift(row);
        body = row;
      } else if (req.method() === "PATCH") {
        const row = rows.find((r) => r.id === id);
        Object.assign(row!, req.postDataJSON());
        body = row;
      } else body = id ? rows.find((r) => r.id === id) : rows;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { writes: () => writes };
}
async function login(page: Page) {
  await page.goto("/requests");
  await page.getByLabel("Рабочий email").fill("tester@example.com");
  await page.getByLabel("Пароль", { exact: true }).fill("Test-password-123");
  await page.getByRole("button", { name: "Войти в аккаунт" }).click();
  await expect(page.getByRole("heading", { name: /Мои заявки/ })).toBeVisible();
}
test("protected route, confirmation and sign-up", async ({ page }) => {
  await api(page, { confirmation: true });
  await page.goto("/requests/new");
  await expect(page).toHaveURL(/login/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-auth.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await page.getByLabel("Рабочий email").fill("tester@example.com");
  await page.getByLabel("Пароль", { exact: true }).fill("Test-password-123");
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page.getByRole("status")).toContainText("Проверьте почту");
  await expect(page).toHaveURL(/login/);
});
test("full lifecycle, search, filters, persistence and narrow layout (mock API)", async ({
  page,
}) => {
  const mock = await api(page);
  await login(page);
  await page.getByRole("link", { name: "Новая заявка", exact: true }).click();
  await page.getByLabel(/Название заявки/).fill("Бот согласования");
  await page
    .getByLabel(/Описание задачи/)
    .fill("Упростить согласование отпусков");
  await page.getByLabel(/Категория/).selectOption("Бот");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/${test.info().project.name}-form.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Создать заявку", exact: true })
    .dblclick();
  await expect(
    page.getByRole("status").filter({ hasText: "Заявка создана" }),
  ).toBeVisible();
  expect(mock.writes()).toBe(1);
  await expect(page.locator("tbody .badge")).toHaveText("Новая");
  await page
    .getByRole("link", { name: "Бот согласования", exact: true })
    .click();
  await page.getByLabel(/Название заявки/).fill("HR бот");
  await page.getByLabel("Статус", { exact: true }).selectOption("В работе");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Изменения сохранены" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "HR бот", exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Поиск по названию" }).fill("hr");
  await page.getByLabel("Фильтр по статусу").selectOption("Завершена");
  await expect(page.getByText("Ничего не найдено")).toBeVisible();
  await page.getByLabel("Фильтр по статусу").selectOption("В работе");
  await expect(
    page.getByRole("link", { name: "HR бот", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сбросить" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Выйти из аккаунта" }).click();
  await expect(page).toHaveURL(/login/);
  await login(page);
  await expect(
    page.getByRole("link", { name: "HR бот", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${test.info().project.name}-requests.png`,
    fullPage: true,
  });
});
test("network save failure is visible and permits retry", async ({ page }) => {
  await api(page, { failSave: true });
  await login(page);
  await page.getByRole("link", { name: "Новая заявка", exact: true }).click();
  await page.getByLabel(/Название заявки/).fill("Отчёт");
  await page.getByLabel(/Описание задачи/).fill("Продажи");
  await page.getByLabel(/Категория/).selectOption("Отчёт");
  await page
    .getByRole("button", { name: "Создать заявку", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Проверьте интернет");
  await expect(
    page.getByRole("button", { name: "Создать заявку", exact: true }),
  ).toBeEnabled();
});

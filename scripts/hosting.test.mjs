import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { once } from "node:events";
import { createStaticServer, publicConfig } from "../server.mjs";

const env = {
  VITE_SUPABASE_URL: "https://test-project.supabase.co",
  VITE_SUPABASE_ANON_KEY: "sb_publishable_test",
};
test("В браузер попадает только разрешённая публичная конфигурация", () => {
  assert.deepEqual(
    publicConfig({
      ...env,
      RLS_A_PASSWORD: "не передавать",
      PRIVATE_VALUE: "не передавать",
    }),
    {
      supabaseUrl: env.VITE_SUPABASE_URL,
      supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
    },
  );
  assert.throws(() =>
    publicConfig({
      ...env,
      VITE_SUPABASE_ANON_KEY: ["sb", "secret", "test"].join("_"),
    }),
  );
  const jwt = (role) =>
    [
      "header",
      Buffer.from(JSON.stringify({ role })).toString("base64url"),
      "signature",
    ].join(".");
  assert.throws(() =>
    publicConfig({ ...env, VITE_SUPABASE_ANON_KEY: jwt("service_role") }),
  );
  assert.ok(publicConfig({ ...env, VITE_SUPABASE_ANON_KEY: jwt("anon") }));
  assert.throws(() =>
    publicConfig({ ...env, VITE_SUPABASE_URL: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    publicConfig({
      ...env,
      VITE_SUPABASE_URL: "https://user:password@test.supabase.co",
    }),
  );
});
test("HTTP: SPA, runtime-конфигурация, статика и закрытые пути", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ld-latte-hosting-"));
  const cleanupPath = resolve(directory);
  if (
    dirname(cleanupPath) !== resolve(tmpdir()) ||
    !basename(cleanupPath).startsWith("ld-latte-hosting-")
  ) {
    throw new Error(
      "Отказ от удаления каталога вне временной области этого теста.",
    );
  }
  const server = createStaticServer({ directory, env });
  try {
    await mkdir(join(directory, "assets"));
    await writeFile(
      join(directory, "index.html"),
      '<div id="root">LD LATTE</div>',
    );
    await writeFile(
      join(directory, "assets", "app-test.js"),
      "console.log('test');",
    );
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of [
      "/",
      "/login",
      "/requests/11111111-1111-4111-8111-111111111111",
    ]) {
      const r = await fetch(base + path);
      assert.equal(r.status, 200);
      assert.match(await r.text(), /LD LATTE/);
    }
    const config = await fetch(base + "/runtime-config.js");
    assert.equal(config.headers.get("cache-control"), "no-store");
    assert.match(await config.text(), /sb_publishable_test/);
    const asset = await fetch(base + "/assets/app-test.js");
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /javascript/);
    for (const path of [
      "/assets/missing.js",
      "/.env.local",
      "/%2e%2e%2fpackage.json",
    ]) {
      assert.equal((await fetch(base + path)).status, 404);
    }
    const head = await fetch(base + "/login", { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(
      (await fetch(base + "/requests", { method: "POST" })).status,
      405,
    );
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    await rm(cleanupPath, { recursive: true, force: true });
  }
});

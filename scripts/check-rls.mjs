import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const env = process.env;
for (const key of [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "RLS_A_EMAIL",
  "RLS_A_PASSWORD",
  "RLS_B_EMAIL",
  "RLS_B_PASSWORD",
])
  assert.ok(env[key], `Missing ${key}`);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const a = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
const b = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
const login = async (c, email, password) => {
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return data.user;
};
const ua = await login(a, env.RLS_A_EMAIL, env.RLS_A_PASSWORD);
const ub = await login(b, env.RLS_B_EMAIL, env.RLS_B_PASSWORD);
assert.notEqual(ua.id, ub.id, "Use two different users");
const title = `RLS test ${new Date().toISOString()}`;
async function insert(c, category = "Бот") {
  const result = await c
    .from("requests")
    .insert({
      title,
      description: "Integration check; safe to delete in SQL editor afterwards",
      category,
    })
    .select()
    .single();
  assert.ifError(result.error);
  return result.data;
}
try {
  const ra = await insert(a);
  const rb = await insert(b, "Отчёт");
  assert.equal(ra.user_id, ua.id);
  assert.equal(rb.user_id, ub.id);
  assert.equal(ra.status, "Новая");
  for (const [owner, other, own, foreign] of [
    [a, b, ra, rb],
    [b, a, rb, ra],
  ]) {
    const ownRead = await owner
      .from("requests")
      .select()
      .eq("id", own.id)
      .single();
    assert.ifError(ownRead.error);
    const direct = await other.from("requests").select().eq("id", own.id);
    assert.ifError(direct.error);
    assert.deepEqual(direct.data, []);
    const change = await other
      .from("requests")
      .update({ title: "unauthorized" })
      .eq("id", own.id)
      .select();
    assert.ifError(change.error);
    assert.deepEqual(change.data, []);
    const list = await owner.from("requests").select();
    assert.ifError(list.error);
    assert.ok(list.data.every((r) => r.user_id === own.user_id));
    const spoof = await owner.from("requests").insert({
      title,
      description: "spoof",
      category: "Бот",
      user_id: foreign.user_id,
    });
    assert.ok(spoof.error);
    const transfer = await owner
      .from("requests")
      .update({ user_id: foreign.user_id })
      .eq("id", own.id);
    assert.ok(transfer.error);
  }
  const anonymous = await anon.from("requests").select().eq("id", ra.id);
  assert.ok(anonymous.error || anonymous.data.length === 0);
  for (const bad of [
    { title: " " },
    { description: "" },
    { category: "Invalid" },
    { status: "Invalid" },
  ]) {
    const result = await a.from("requests").update(bad).eq("id", ra.id);
    assert.ok(result.error, "DB must reject invalid fields");
  }
  const forged = await a.from("requests").insert({
    title,
    description: "initial status spoof",
    category: "Бот",
    status: "Завершена",
  });
  assert.ok(forged.error);
  const updated = await a
    .from("requests")
    .update({ title: title + " updated", status: "В работе" })
    .eq("id", ra.id)
    .select()
    .single();
  assert.ifError(updated.error);
  assert.equal(updated.data.status, "В работе");
  assert.equal(updated.data.created_at, ra.created_at);
  await a.auth.signOut();
  await login(a, env.RLS_A_EMAIL, env.RLS_A_PASSWORD);
  const persisted = await a.from("requests").select().eq("id", ra.id).single();
  assert.ifError(persisted.error);
  assert.equal(persisted.data.title, title + " updated");
  console.log(
    "PASS: authenticated CRUD, persistence, A/B isolation, direct read/update, ownership spoofing, anonymous access and DB validation.",
  );
  console.log(
    `Test rows remain for inspection: ${ra.id}, ${rb.id}. Remove them with SQL editor as project owner.`,
  );
} finally {
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}

import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
// Real PostgreSQL in WASM; minimal Supabase auth schema only, not a hosted API.
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
let checks = 0;
const check = (condition) => {
  assert.ok(condition);
  checks++;
};
async function rejected(sql) {
  await assert.rejects(db.exec(sql));
  checks++;
}
try {
  await db.exec(`create role anon;create role authenticated;
 create schema auth;create table auth.users(id uuid primary key);
 insert into auth.users values ('${a}'),('${b}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202611040001_requests.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
  );
  const {
    rows: [row],
  } = await db.query(
    "insert into public.requests(title,description,category) values ('Бот','Описание','Бот') returning *",
  );
  check(row.user_id === a && row.status === "Новая");
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  check((await db.query("select * from public.requests")).rows.length === 0);
  check(
    (await db.query("select * from public.requests where id=$1", [row.id])).rows
      .length === 0,
  );
  check(
    (
      await db.query(
        "update public.requests set title='Hacked' where id=$1 returning *",
        [row.id],
      )
    ).rows.length === 0,
  );
  await rejected(
    `insert into public.requests(title,description,category,user_id) values ('Spoof','Desc','Бот','${a}')`,
  );
  await db.exec(
    "insert into public.requests(title,description,category) values ('Отчёт','Продажи','Отчёт')",
  );
  check(
    (await db.query("select * from public.requests")).rows.every(
      (r) => r.user_id === b,
    ),
  );
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false)`);
  await rejected(
    `update public.requests set user_id='${b}' where id='${row.id}'`,
  );
  for (const fields of [
    "title=' '",
    "description=''",
    "title=E'\\t\\n'",
    "description=E'\\t\\n'",
    "category='INVALID'",
    "status='INVALID'",
  ])
    await rejected(`update public.requests set ${fields} where id='${row.id}'`);
  await rejected(
    "insert into public.requests(title,description,category,status) values ('Test','Desc','Бот','Завершена')",
  );
  await rejected(
    `update public.requests set created_at=now() where id='${row.id}'`,
  );
  await rejected(`delete from public.requests where id='${row.id}'`);
  const updated = await db.query(
    "update public.requests set title='Changed',description='Edited',category='Другое',status='В работе' where id=$1 returning *",
    [row.id],
  );
  check(
    updated.rows[0].title === "Changed" &&
      updated.rows[0].status === "В работе",
  );
  check(
    new Date(updated.rows[0].created_at).getTime() ===
      new Date(row.created_at).getTime(),
  );
  check(
    new Date(updated.rows[0].updated_at).getTime() >=
      new Date(row.updated_at).getTime(),
  );
  await db.exec("set role anon");
  await rejected("select * from public.requests");
  await db.exec("reset role");
  const editorScenario = (
    await readFile(
      new URL("../supabase/tests/verify_requests.sql", import.meta.url),
      "utf8",
    )
  )
    .replaceAll("REPLACE_WITH_USER_A_UUID", a)
    .replaceAll("REPLACE_WITH_USER_B_UUID", b);
  const before = await db.query(
    "select count(*)::integer as count from public.requests",
  );
  const editorResult = await db.exec(editorScenario);
  check(
    editorResult.some((result) =>
      result.rows.some((row) => String(row.result).startsWith("PASS:")),
    ),
  );
  const after = await db.query(
    "select count(*)::integer as count from public.requests",
  );
  check(after.rows[0].count === before.rows[0].count);
  console.log(
    `PASS: ${checks} PostgreSQL checks: migration, defaults, validation, timestamps, RLS A/B, ownership/column grants, anonymous and delete denial.`,
  );
} finally {
  await db.close();
}

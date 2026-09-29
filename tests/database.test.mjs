import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const alice = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", bob = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const trip = "11111111-1111-1111-1111-111111111111", other = "22222222-2222-2222-2222-222222222222", second = "33333333-3333-3333-3333-333333333333";
const activity = "44444444-4444-4444-4444-444444444444";
const expense = "55555555-5555-5555-5555-555555555555";
const item = "66666666-6666-6666-6666-666666666666";
async function asUser(user) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
}

before(async () => {
  // Reproduce Supabase's auth identity function and public table grants in an isolated DB.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
    insert into auth.users values ('${alice}'),('${bob}');`);
  for (const file of ["202609250001_create_trips.sql", "202609260001_ensure_trips_table.sql", "202609270001_trip_workspace.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await asUser(alice);
  await db.query("insert into trips(id,user_id,title,destination,start_date,end_date,time_zone) values ($1,$2,'Japan','Tokyo','2026-09-27','2026-10-01','Asia/Tokyo'),($3,$2,'Paris','Paris','2026-09-27','2026-10-01','Europe/Paris')", [trip, alice, second]);
  await db.query("insert into activities(id,trip_id,title,category,date,time,time_zone) values ($1,$2,'Museum','Activity','2026-09-28','10:00','Asia/Tokyo')", [activity, trip]);
  await db.query("insert into expenses(id,trip_id,title,amount_minor,currency,category,date) values ($1,$2,'Lunch',1250,'USD','Food','2026-09-28')", [expense, trip]);
  await db.query("insert into packing_items(id,trip_id,name,category) values ($1,$2,'Passport','Essentials')", [item, trip]);
  await asUser(bob);
  await db.query("insert into trips(id,user_id,title,destination,start_date,end_date) values ($1,$2,'Other trip','Rome','2026-09-27','2026-10-01')", [other, bob]);
});
after(async () => { await db.close(); });

test("owners can read and update their trip records", async () => {
  await asUser(alice);
  assert.equal((await db.query("select * from activities")).rows.length, 1);
  assert.equal((await db.query("select * from expenses")).rows.length, 1);
  assert.equal((await db.query("update packing_items set packed=true where id=$1 returning packed", [item])).rows[0].packed, true);
});

test("another user cannot read, update, delete or insert records on a foreign trip", async () => {
  await asUser(bob);
  for (const table of ["activities", "expenses", "packing_items"]) {
    assert.equal((await db.query(`select * from ${table} where trip_id=$1`, [trip])).rows.length, 0);
    assert.equal((await db.query(`delete from ${table} where trip_id=$1 returning id`, [trip])).rows.length, 0);
  }
  assert.equal((await db.query("update activities set title='Stolen' where id=$1 returning id", [activity])).rows.length, 0);
  await assert.rejects(db.query("insert into packing_items(trip_id,name,category) values ($1,'Intruder','Essentials')", [trip]));
  await assert.rejects(db.query("insert into activities(trip_id,title,category,date,time_zone) values ($1,'Intruder','Activity','2026-09-28','UTC')", [trip]));
  await assert.rejects(db.query("insert into expenses(trip_id,title,amount_minor,currency,category,date) values ($1,'Intruder',100,'USD','Other','2026-09-28')", [trip]));
});

test("unauthenticated users cannot access workspace tables", async () => {
  await db.exec("reset role; set role anon;");
  await assert.rejects(db.query("select * from packing_items"), /permission denied/);
});

test("records cannot be reassigned between trips, even for the same owner", async () => {
  await asUser(alice);
  await assert.rejects(db.query("update packing_items set trip_id=$1 where id=$2", [second, item]), /cannot be moved/);
});

test("database rejects mismatched currencies and currency changes with recorded expenses", async () => {
  await asUser(alice);
  await assert.rejects(db.query("update trips set currency='EUR' where id=$1", [trip]), /Cannot change currency/);
  await assert.rejects(db.query("insert into expenses(trip_id,title,amount_minor,currency,category,date) values ($1,'Stale cost',100,'EUR','Other','2026-09-28')", [trip]), /must match/);
  await assert.rejects(db.query("update expenses set amount_minor=-10 where id=$1", [expense]), /check constraint/);
});

test("database preserves itinerary boundaries and validates time zones", async () => {
  await asUser(alice);
  await assert.rejects(db.query("update trips set start_date='2026-09-29' where id=$1", [trip]), /must contain/);
  await assert.rejects(db.query("update activities set date='2026-10-05' where id=$1", [activity]), /inside trip/);
  await assert.rejects(db.query("update activities set time_zone='Mars/Olympus' where id=$1", [activity]), /Invalid time zone/);
});

test("deleting an owned trip cascades its workspace without affecting other trips", async () => {
  await asUser(alice);
  await db.query("delete from trips where id=$1", [trip]);
  for (const table of ["activities", "expenses", "packing_items"]) assert.equal((await db.query(`select * from ${table} where trip_id=$1`, [trip])).rows.length, 0);
  assert.equal((await db.query("select * from trips")).rows.length, 1);
  await asUser(bob);
  assert.equal((await db.query("select * from trips")).rows[0].id, other);
});

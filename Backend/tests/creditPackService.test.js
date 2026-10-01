// Integration tests for the credit-pack catalog (spec §48 Credit Pack). Runs against the
// dev Neon DB; assumes `npm run seed:packs` has populated SMALL/MEDIUM/LARGE. Creates and
// cleans up a throwaway pack for the mutation tests. Run: npm test
import "dotenv/config";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import sql from "../config/Neon.js";
import {
  getActivePacks,
  getPack,
  createPack,
  updatePack,
  disablePack,
} from "../services/creditPackService.js";
import { CREDIT_PACKS } from "../config/creditPacks.js";

const tmpKeys = [];
const tmpKey = () => {
  const k = `TEST_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  tmpKeys.push(k);
  return k;
};

after(async () => {
  if (tmpKeys.length) await sql`DELETE FROM credit_packs WHERE key = ANY(${tmpKeys})`;
});

test("seeded packs exist with correct price and credits", async () => {
  const packs = await getActivePacks();
  const byKey = Object.fromEntries(packs.map((p) => [p.key, p]));
  for (const key of ["SMALL", "MEDIUM", "LARGE"]) {
    assert.ok(byKey[key], `${key} should be an active pack`);
    assert.equal(byKey[key].price, CREDIT_PACKS[key].price);
    assert.equal(byKey[key].credits, CREDIT_PACKS[key].credits);
    assert.equal(byKey[key].currency, "INR");
  }
});

test("getActivePacks is ordered by price ascending", async () => {
  const prices = (await getActivePacks()).map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
});

test("getPack returns a single pack by key", async () => {
  const large = await getPack("LARGE");
  assert.equal(large.key, "LARGE");
  assert.equal(large.credits, 30);
});

test("an inactive pack is hidden from getActivePacks", async () => {
  const key = tmpKey();
  await createPack({ key, name: "Temp", credits: 7, price: 70 });
  assert.ok((await getActivePacks()).some((p) => p.key === key));

  await disablePack(key);
  assert.ok(!(await getActivePacks()).some((p) => p.key === key));
  // Still retrievable by key (history/admin), just not active.
  assert.equal((await getPack(key)).isActive, false);
});

test("pack keys are unique — a duplicate create is rejected", async () => {
  const key = tmpKey();
  await createPack({ key, name: "Temp", credits: 7, price: 70 });
  await assert.rejects(() => createPack({ key, name: "Dup", credits: 1, price: 1 }));
});

test("updatePack changes stored price/credits", async () => {
  const key = tmpKey();
  await createPack({ key, name: "Temp", credits: 7, price: 70 });
  const updated = await updatePack(key, { credits: 9, price: 90 });
  assert.equal(updated.credits, 9);
  assert.equal(updated.price, 90);
});

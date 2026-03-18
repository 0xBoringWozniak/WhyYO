import { seedDevAliases } from "../../apps/api/src/bootstrap/seed-dev-aliases";
import { getDb } from "../../apps/api/src/db/pool";

const run = async (): Promise<void> => {
  const db = getDb();
  const count = await seedDevAliases(db);
  console.log(`Seeded ${count} canonical protocols`);
  await db.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

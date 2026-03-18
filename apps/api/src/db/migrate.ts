import { applyMigrations } from "../bootstrap/migrate";
import { getDb } from "./pool";

const run = async (): Promise<void> => {
  const db = getDb();
  const files = await applyMigrations(db);
  for (const file of files) {
    console.log(`Applied migration ${file}`);
  }
  await db.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { importRiskDataset } from "../../apps/api/src/bootstrap/import-risk-dataset";
import { getEnv } from "../../apps/api/src/config/env";
import { getDb } from "../../apps/api/src/db/pool";

const run = async (): Promise<void> => {
  const db = getDb();
  getEnv();
  const summary = await importRiskDataset(db);
  console.log(
    JSON.stringify(
      { message: "risk dataset import complete", ...summary },
      null,
      2,
    ),
  );

  await db.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

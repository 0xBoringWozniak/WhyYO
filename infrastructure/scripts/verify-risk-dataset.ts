import { getDb } from "../../apps/api/src/db/pool";
import { RiskRepository } from "../../apps/api/src/repositories/risk-repository";

const run = async (): Promise<void> => {
  const db = getDb();
  const repository = new RiskRepository();
  const version = await repository.getActiveVersion();
  const pools = await repository.listActivePools();
  const slug = process.argv[2];

  const counts = await Promise.all([
    db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM risk_dataset_versions"),
    db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM risk_pools"),
    db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM risk_pool_assets"),
    db.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM risk_blockchains"),
  ]);

  console.log("Active version:", version);
  console.log("Counts:", {
    datasetVersions: Number(counts[0].rows[0].count),
    riskPools: Number(counts[1].rows[0].count),
    riskPoolAssets: Number(counts[2].rows[0].count),
    riskBlockchains: Number(counts[3].rows[0].count),
  });

  if (slug) {
    console.log(`Slug lookup for ${slug}:`, await repository.searchPoolsBySlug(slug));
  } else {
    console.log("Sample rows:", pools.slice(0, 5).map((pool) => ({
      slug: pool.slug,
      bucket: pool.bucket,
      strategyType: pool.strategyType,
      riskGrade: pool.riskGrade,
      riskNumeric: pool.riskNumeric,
      protocolFamily: pool.protocolFamily,
    })));
  }

  await db.end();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

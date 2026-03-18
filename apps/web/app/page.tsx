import { ScanShell } from "../components/scan-shell";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ resume?: string }>;
}) {
  const params = (await searchParams) ?? {};
  if (params.resume === "1") {
    return <ScanShell initialBootStage="active" />;
  }

  return <ScanShell />;
}

import { notFound } from "next/navigation";

import { ScanShell } from "../../components/scan-shell";

const isWalletAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

export default async function WalletPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;

  if (!isWalletAddress(wallet)) {
    notFound();
  }

  return <ScanShell initialWalletAddress={wallet} />;
}

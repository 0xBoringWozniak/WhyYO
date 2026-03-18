import yoBtcLogo from "../../../assets/png/yoBTC.png";
import yoEthLogo from "../../../assets/png/yoETH.png";
import yoEurLogo from "../../../assets/png/yoEUR.png";
import yoMark from "../../../assets/png/yo_no_bg.png";
import yoUsdLogo from "../../../assets/png/yoUSD.png";

const vaultLogos = {
  yoUSD: yoUsdLogo.src,
  yoETH: yoEthLogo.src,
  yoBTC: yoBtcLogo.src,
  yoEUR: yoEurLogo.src,
  yoUSDT: yoUsdLogo.src,
  yoGOLD: yoEurLogo.src,
} as const;

const vaultAccent = {
  yoUSD: "#16f88f",
  yoETH: "#61d9ff",
  yoBTC: "#ffb347",
  yoEUR: "#5c74ff",
  yoUSDT: "#16f88f",
  yoGOLD: "#ffc83d",
} as const;

export const yoBrandMarkUrl = yoMark.src;

export const getVaultLogoUrl = (vaultSymbol: keyof typeof vaultLogos | string): string =>
  vaultLogos[vaultSymbol as keyof typeof vaultLogos] ?? yoMark.src;

export const getVaultAccent = (vaultSymbol: keyof typeof vaultAccent | string): string =>
  vaultAccent[vaultSymbol as keyof typeof vaultAccent] ?? "#d7ff1f";

export const getInitials = (value: string): string =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

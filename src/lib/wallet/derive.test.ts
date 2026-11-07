import { expect, it } from "vitest";
import { deriveAddresses } from "./derive";

// Standard BIP39 test phrase; addresses match MetaMask / Phantom / BIP84 reference vectors.
const PHRASE = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

it("derives standard addresses for every supported network", () => {
  const a = deriveAddresses(PHRASE);
  expect(a.evm).toBe("0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
  expect(a.bitcoin).toBe("bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu");
  expect(a.ton).toMatch(/^UQ[A-Za-z0-9_-]{46}$/);
  expect(a.solana).toBe("HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk");
});

import { tronFromEvm, tronToHex } from "./derive";
describe("tron address", () => {
  it("shares the EVM account bytes", () => {
    const evm = "0x8B9fA6D5761946e2c79a1fE276c5eA99468351Cd";
    const t = tronFromEvm(evm);
    expect(t.startsWith("T")).toBe(true);
    expect(tronToHex(t)).toBe("41" + evm.slice(2).toLowerCase());
  });
});

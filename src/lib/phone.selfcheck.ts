// Run with: pnpm dlx tsx src/lib/phone.selfcheck.ts
// Pure function, no Supabase/env needed — unlike the other *.selfcheck.ts
// files in this folder.
import assert from "node:assert";
import { normalizePolishPhone } from "./phone";

function main() {
  // Spacing/dashes/parens are tolerated — the +48 country code is hardcoded,
  // not detected (see phone.ts), so these all describe the same 9 digits.
  const equivalent = ["600100200", "600 100 200", "600-100-200", "(600) 100 200"];
  for (const input of equivalent) {
    assert.equal(normalizePolishPhone(input), "+48600100200", `expected ${input} to normalize`);
  }

  // Rejects: wrong length, a leading 0 (no domestic trunk prefix since 2005),
  // an explicit country code (the UI never collects one, so a stray "+48"
  // getting through means something upstream is wrong), non-numeric junk.
  const invalid = ["12345", "0600100200", "600100", "600100200600", "+48600100200", "0048600100200", "abc", ""];
  for (const input of invalid) {
    assert.equal(normalizePolishPhone(input), null, `expected ${input} to be rejected`);
  }

  console.log("phone.ts self-check passed");
}

main();

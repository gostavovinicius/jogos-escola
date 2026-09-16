// Regression checks for the four gameplay systems in the active game.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(process.execPath, [
  "--test", "tests/gameplay.test.mjs", "tests/navigation.test.mjs",
], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
});
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;

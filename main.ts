// Sky Ranger — the hand-in program for the best flight game bounty.
// Runs on Node 22 with the standard library only. It gathers the game and
// its screenshots into the output directory and writes the dossier the
// judge reads, using the kit's vendored dossier library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Game files first: the whole static game, plain files only.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// Screenshots: the maker's own renders of the game, 3 or 4 of them.
const shotsDir = join(repoRoot, 'screenshots');
const outShotsDir = join(outputDir, 'screenshots');
mkdirSync(outShotsDir, { recursive: true });
if (existsSync(shotsDir)) {
  for (const name of readdirSync(shotsDir).sort()) {
    const src = join(shotsDir, name);
    if (statSync(src).isFile()) cpSync(src, join(outShotsDir, name));
  }
}

// The dossier: the library re-derives it from the output files, so what
// the judge reads is exactly what the game ships.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

# Sky Ranger

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Daniikhwan/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Daniikhwan/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A chase-view flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the Sky Ranger through golden rings over procedural valleys, mind your fuel, dodge stone peaks, and land on the runway to clear each sortie.

## The game

- **Three sorties**: Ring Run (green valleys), Canyon Dash (stone peaks), Storm Night (dusk storm, lightning, gusts).
- **Real flight model**: throttle, pitch, bank, stall, fuel burn, hull damage, landing gear.
- **Chase view** over recognisable terrain: rivers, patchwork fields, mountain ridges, clouds, and a runway with edge lights.
- **Lit instruments**: airspeed and altitude dials, heading compass tape, fuel and throttle gauges, stall / low-fuel / pull-up warnings.
- **Synthesised sound**: engine hum tied to throttle, wind, ring chimes, crash thuds, landing fanfare — all WebAudio, no audio files.
- **Score**: rings build a combo multiplier, landings pay a bonus, the clock pays the rest.

## Controls

| Key | Action |
| --- | --- |
| ← → / A D | Bank and turn |
| ↑ ↓ | Pitch up / down |
| W / S | Throttle up / down (mouse wheel works too) |
| Mouse | Hold and drag to steer |
| G | Landing gear (land slow, low, on the runway) |
| P | Pause · M mute · H help · R restart |

Touch: drag the left side to steer, right edge for throttle.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files.

## Layout

- `game/index.html` — the page; `game/src/` — one file per job (`config`, `random`, `audio`, `input`, `terrain`, `plane`, `render`, `hud`, `missions`, `shots`, `main`).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — real renders of the game in a browser.

## License

MIT — see [LICENSE](LICENSE).

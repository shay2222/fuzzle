# Fuzzle and the Shifting Woods

A cute top-down roguelite adventure that runs in the browser. Fuzzle, a fluffy blue-and-yellow hero, crosses three cursed lands to gather the Heart Crystals and free his family from the warlock Oink. Every time you fall, the level regrows into a new layout.

**Play it:** https://shay2222.github.io/fuzzle/

**Project page:** https://shay2222.github.io/fuzzle-portfolio/

## How to play

| Key | Action |
| --- | --- |
| WASD or arrow keys | Move |
| Space | Dash |
| E | Talk to a character |
| T | Developer panel |
| P or Esc | Pause |
| M | Sound on/off |

Collect every sparkle seed to wake the portal. Seeds you finish a level with go into your pouch, which you can spend at Croaksworth's stall.

## What's inside

- **Levels that regrow on every fall.** Each layout comes from a seed and only ships if a checker proves every seed and the portal can be reached.
- **A story and a boss.** Three lands (Mossy Woods, Crystal Caves, Cloud Tops), a rescued sibling at the end of each, and a final fight against Oink.
- **Characters with a guarded dialogue system.** Old Hoot (hints and lore), Croaksworth (a merchant who haggles) and Dot (quests). A generator drafts each line from the game's real state. A guard then checks facts, prices, directions, names and staying in character before the player sees anything. Bad drafts get one retry, then a written fallback. Open the developer panel (T) to plant mistakes and watch the guard catch them.
- **Music made in code.** One original theme, arranged differently for each land and for the boss fight, played with the Web Audio API. There are no audio files.
- **No assets and no build step.** All the art is drawn with Canvas 2D. The game is plain JavaScript, HTML and CSS.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout, HUD, menus and styles |
| `engine.js` | Game loop, input, storage and maths helpers |
| `fx.js` | Particles and sound effects |
| `music.js` | Background music |
| `fuzzle.js` | Fuzzle's drawing and movement |
| `family.js` | Fuzzle's family and followers |
| `oink.js` | Oink and the Heart Crystals |
| `areas.js` | The look of each land |
| `levels.js` | Level generator and solvability checker |
| `critters.js` | Bees, bats and storm clouds |
| `world.js` | Tiles, hazards and lighting |
| `boss.js` | The boss arena and fight |
| `npcs.js` | Characters, shop items and quests |
| `brain.js` | Dialogue generator, guard and fallbacks |
| `talk.js` | The conversation box |
| `story.js` | Storybook cutscenes |
| `game.js` | Ties everything together |

## Credits

Design and direction by Shane Singh. Built with AI-assisted development.

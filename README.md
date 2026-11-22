# Civilizations Wars — Web Clone

A native HTML5/Canvas reimplementation of the classic Flash RTS [Civilizations Wars](https://bubblebox.com/civilizations-wars). No Flash, no emulator, no ads — just vanilla JS.

## Run

Serve the folder statically and open `index.html`:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static file server works (no build step).

## How to play

- **Goal:** capture every building on the map before your enemies do.
- **Send troops:** press on one of your buildings, drag over more of your buildings to add them, release on the target. Each sends half its garrison.
- **Houses** grow population (infantry). **Shrines** generate crystal energy and send fast cavalry. **Towers** shoot arrows at passing enemies and send heavy infantry worth two defenders each.
- **Spells** cost crystal energy: Fireball, Lightning, Meteorite, Twister, Hypnoses, Support, Shield, Swamp, Golem, Quake — all upgradable to rank 7.
- **Civilizations:** Egyptians (balanced), Romans (defense + deep crystal pool), Chinese (speed + growth).
- **Progression:** wins earn XP (faster wins earn more); spend it on stats and spells between battles. Progress is saved in `localStorage`.
- 10-level campaign including the Giant Turtle boss fight.

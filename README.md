# ⚔️ TimeStrike — 2D Platformer Fighter

A browser-based 2-player platformer fighting game. No dependencies, no build step — just open `index.html` and fight.

---

## 🎮 Controls

### Player 1 — "The Chronomancer" (Blue)
| Key | Action |
|-----|--------|
| `W` | Jump (double jump supported) |
| `A` | Move Left |
| `D` | Move Right |
| `X` | Basic Attack — 12 dmg, **1 second cooldown** |
| `Z` | **TIME STOP** — freezes Player 2 for 3 seconds. 10s cooldown. |

### Player 2 — "The Dasher" (Red)
| Key | Action |
|-----|--------|
| `↑` | Jump (double jump supported) |
| `←` | Move Left |
| `→` | Move Right |
| `1` | Basic Attack — 12 dmg |
| `0` | **FORWARD DASH** — deals 18 dmg on contact. 5s cooldown. |

---

## 🕹️ How to Play

1. Open `index.html` in any modern browser.
2. Click **FIGHT** on the main menu.
3. Reduce your opponent's HP to 0, or have more HP when the 60-second timer runs out.

---

## 📁 File Structure

```
timestrike/
├── index.html   # Game markup & screens (menu, game, controls, game over)
├── style.css    # All visual styling & animations
├── engine.js    # Physics engine & rendering utilities
├── player.js    # Player class (movement, attacks, abilities)
└── game.js      # Game loop, input, combat, HUD, screen management
```

---

## ⚡ Abilities

### Time Stop (Player 1 — `Z`)
- Instantly freezes **Player 2** in place for **3 seconds**
- Player 1 can still move, attack, and reposition freely during the freeze
- Cooldown: **10 seconds**
- A purple screen overlay and visual effect activates during time stop

### Dash Strike (Player 2 — `0`)
- Player 2 launches forward in the direction they're facing at high speed
- Deals **18 damage** on contact — more than a basic attack
- Has a slight vertical lift to avoid hugging the ground
- Cooldown: **5 seconds**

---

## 🗺️ Stage

The arena features 6 platforms:
- A wide ground platform spanning the full width
- Two lower side ledges for early positioning
- A center elevated platform — high-value real estate
- Two high corner platforms for evasion and ability setups

---

## 🛠️ Technical Notes

- Pure vanilla JavaScript — no frameworks, no bundler required
- Canvas-based rendering with per-frame physics
- Separate modules: `engine.js` handles physics math and draw calls; `player.js` is the entity class; `game.js` is the coordinator
- Double-jump supported for both players
- Knockback applied on every hit
- Particle system for hit effects and time stop activation
- CSS-only visual effects for time stop (filter + vignette)

---

## 🖥️ Browser Compatibility

Tested in Chrome, Firefox, Edge, and Safari. Requires a browser with `requestAnimationFrame` and Canvas 2D support (all modern browsers).

---

## 📝 License

MIT — free to use, modify, and distribute.

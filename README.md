# Three-Team Tank Siege

A local 3-team tank siege in the browser. Blue, Green, and Red each have a territory, multiple building types, NPCs, and giant player tanks with HP and respawn. Level all enemy buildings to win.

## Controls

- Player 1 (Blue)
  - Move: W / A / S / D
  - Fire: C
- Player 2 (Red)
  - Move: Arrow keys
  - Fire: / (Slash) or Numpad /
- Player 3 (Green)
  - Move: I / J / K / L
  - Fire: B

Press R to restart after a match ends.

## How to Play

1. Open `index.html` in your browser (double-click it).
2. Drive into enemy territories and shoot their buildings.
3. Buildings come in several types with different sizes and HP: block, factory, barracks, tower.
4. Giant tanks have HP rings and respawn after destruction.
5. Roaming cartoon people wander each side and shoot at enemies (tanks and buildings).
6. Three territories are split by dashed lines at 1/3 and 2/3 of the map width.
7. Destroy all enemy buildings to win.

## Notes

- Bullets collide with buildings, walls, enemy tanks, and enemy people.
- Buildings block tank movement for all teams.
- People are not solid but can be damaged by bullets.
- If keys do not respond, click once on the page to focus it.

## Troubleshooting

- If your browser blocks local file scripting, try using a lightweight static server. With Python installed you can serve the folder and visit `http://localhost:8000`:

```powershell
# optional
python -m http.server 8000
```

- In VS Code you can also use the "Live Server" extension to run this as a site.

## Live (GitHub Pages)

This repo is configured to deploy to GitHub Pages on each push to `main` using GitHub Actions.

After the first push with the workflow:
- Go to GitHub repo Settings → Pages → Build and deployment
- Ensure Source is set to "GitHub Actions"
- The site will publish at: https://IDoRush.github.io/tank_shooter/

# 03 — Open Questions

When a question is answered, the answer is recorded as a decision in `02-decisions.md` and the
question is removed from this list.

## Technology and delivery
- Q1. Application stack: Electron, Tauri, or a game engine such as Godot?
- Q2. Where does the code live, and where are release builds made? Local only, or a private GitHub
  repository with automated builds for all four platform targets?
- Q3. Should the installers be code-signed? An unsigned Windows installer triggers a SmartScreen
  "Windows protected your PC" warning on first run.
- Q4. Which Linux distribution and desktop is used, so we know which package formats to build
  (AppImage, .deb, Flatpak)?

## Games and rules
- Q5. Which game should be built first?
- Q6. Poker: which variant? Texas Hold'em, Five-Card Draw, or something else? Played for chips, with a bankroll?
- Q7. Solitaire: which variants? Klondike only, or also FreeCell, Spider, and others? Draw 1 or draw 3?
- Q8. House rules worth matching in each game, for example: is Hearts broken when the Queen of Spades
  is played, is "shooting the moon" allowed, are there nil and blind-nil bids in Spades?
- Q9. Should the computer opponents have adjustable difficulty?

## Characters, art, and audio
- Q10. How should character voices be produced? Pre-generated offline text-to-speech clips, the
  operating system's built-in voices at runtime, or recorded human voices?
- Q11. Art style: classic realistic cards and felt table, or a more illustrated or cartoon look?
  Should she be able to choose card backs and table colors?
- Q12. How many characters should there be, and should she pick her opponents?

## Other
- Q13. Keep statistics (games played, wins) and save a game in progress to resume later?
- Q14. What exact Windows tablet model does she use? This tells us the screen size, resolution,
  and orientation to design for.
- Q15. Is "FreeKards" the final product name?

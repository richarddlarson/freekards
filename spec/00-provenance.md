# 00 — Provenance: Original Kick-off Prompt

This is the original request that started the FreeKards project. It is kept **verbatim** as the record of
where the design came from. Do not edit it. Later decisions refine or override it, and they are
recorded in the other spec documents.

- **Date received:** 2026-11-23
- **Author:** Project owner (Rich)

---

> My wife has an old Hoyle Card Games computer game from 2012 that allows her to play car games like hearts, spades, blackjack, poker, Rummy 500, Gin, and Solitaire.  It's a basic card game app with simple computer players that are your opponents. It has nice card graphics with some animations for the cards dealing and the computer players each has a simple personality and make comments during the game based on how good or bad they (or you) are playing. It also has some basic card dealing and shuffling sounds and the character comments are spoken as well as shown in pop-up word bubbles from the characters.  The app has a very basic but upbeat soundtrack that plays in the background too.
>
> The problem is that she mostly uses a Windows tablet-style PC, and the old app requires an Intel processor to run. No degree of compatibility modification settings will work to allow it to run cleanly on the newer ARM-based tablet PCs.  So she's unable to use those and has to keep buying older PCs that won't work well with newer standards and Windows versions.
>
> My goal:  I'd like to make a new graphical card game that runs on Windows and Linux that has these same games and capabilities and will run on modern ARM versions of Windows and Linux.  I'm not picky on which development stack we build it on, and it can be a web-based stack as long as it runs in it's own window and not just in a browser.  It has to act and feel like a native app, even if under the hood it is using web technologies to render itself.  It also needs to be delivered as a simple installable executable on both systems so that she can install it herself.
>
> I'm not sure what other things you need to know to help me build this, but please ask me questions as necessary to get this project going.  Please place all files for this project into the following local working folder: ~/dev/proj/freekards.  Initialize a local git repository there for versioning this work, and put a /spec folder into it as part of the initialization.  Every time we make a decision on how the game will look, feel, act, be built, installed, executed, or anything else that is relevant (like process instructions for your own use) it needs to become part of the spec for the app, and all spec documents go into /spec as their home.  Effectively if all else were to be lost, we should be able to rebuild the app from the /spec folder alone.  Even this initial kick-off prompt should go into that folder as the provenance of the app's initial design impetus.
>
> So let's get this started. Ask me questions as we go along.

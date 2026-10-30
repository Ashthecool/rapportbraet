# Rapportbrættet

The writing board for the Ashes & Iron DDU report. Open it at https://ashthecool.github.io/rapportbraet/

- Text is shared through Firestore (`firebase-config.js`, rules in `firestore.rules`).
- Several people can write in the same section at once. Each save reads the newest version and merges into it (`merge.js`, tested by `node merge.test.mjs`): changes to different words or rows both stay, and if two people change the same words, both versions are kept for you to tidy up. Text waits in the browser until it is saved, so a closed tab or lost connection doesn't lose it.
- **Send til Word** posts a section to the Report Helper bot through a Discord webhook. Each person pastes the webhook URL once on the board; it is kept only in their browser and must never be committed here.
- **Forskellig fra Word** shows which lines differ. A normal send keeps lines that only exist in Word. **Erstat i Word** removes them too (the message starts with `rapport:<id> !erstat`); pictures, links and other tables stay, and `/undo` reverts it.

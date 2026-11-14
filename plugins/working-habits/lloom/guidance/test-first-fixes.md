---
name: test-first-fixes
description: Reproduce a bug with a failing test before fixing it
---

When you are asked to fix a bug:

1. Reproduce it first. Write the smallest test that fails because of the bug, run it, and confirm it fails for the reason you expect.
2. Fix the cause, not the symptom the test shows.
3. Run the test again and confirm it passes, then run the tests around it to check nothing else broke.

If the code has no test harness, write down the exact steps that reproduce the bug, follow them before and after the fix, and report both results. If you cannot reproduce the bug, say so and stop before changing code.

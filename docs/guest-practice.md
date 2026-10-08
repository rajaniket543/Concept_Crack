# Guest practice

The landing page's free-start buttons (desktop, mobile and footer) open `/try` without creating an account or changing authentication. The hero's secondary action also opens this area, labelled “Explore Practice”.

Guests can choose JEE or NEET, practice each subject, take a timed 15-question mini mock, and review scores and explanations. The public starter library in `src/data/guestQuestions.ts` contains five questions each for Physics, Chemistry, Mathematics and Biology. Mini mocks reuse these starter questions; they are not full-length exam papers or the private question bank.

Scoring is +4 for a correct answer, −1 for an incorrect answer, and 0 for a skipped question. Expired tests submit automatically. The most recent 30 results are stored under `concept-crack:guest-results:v1` in browser localStorage, separately from account records. If storage is unavailable, results remain in memory and the page explains the limitation. Unsubmitted answers are not saved across reloads; an active test prompts before closing or reloading.

Run the application with `npm run dev`, then run `node scripts/check-guest-practice.mjs` to check the guest flow in Playwright. Set `TEST_ORIGIN` to check a different local address. Install the Playwright Chromium browser if it is not already available (`npx playwright install chromium`).

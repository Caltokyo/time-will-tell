# Essay manuscripts

Place each finalised manuscript here as plain text, exactly as approved:

    content/essays/01.md … content/essays/06.md

Format (kept deliberately minimal so the text is reproduced verbatim):

- Blank line = new paragraph. A single line break inside a paragraph is kept as a line break.
- `## ` at the start of a line = section heading.
- `> ` at the start of a line = quotation.
- Nothing else is interpreted (no automatic emphasis, links or typography changes).

Then run `npm run build:essays` and commit the generated `essays/*/index.html`.

Essay 06 must end with the line `TIME WILL TELL.` — the build fails otherwise.
Titles and LP connection points are in `essays.json`.

## English drafts

`content/essays/en/NN.md` holds the English translation of each essay (draft, pending editorial review).

- First line = English title; it must match `titleEn` in `essays.json`.
- Paragraphs must stay aligned with the Japanese manuscript (same number of blank-line-separated blocks) — the build fails otherwise.
- Essay pages open in English; the EN / 日本語 switch shows the approved Japanese text (also `?lang=ja`). The visitor's choice is remembered.
- The Japanese manuscripts (`NN.md`) are never modified by the build.
- `lpTitleJa` (optional) overrides the small Japanese line under the English title on the LP only (used for 03: 何もないことへの目眩。).

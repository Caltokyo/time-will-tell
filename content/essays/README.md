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

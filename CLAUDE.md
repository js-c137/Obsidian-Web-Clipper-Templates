# CLAUDE.md — obsidian-web-clipper-templates

## Project

A collection of 8 Obsidian Web Clipper JSON templates for clipping full-text scientific articles from major academic publishers, optimized for marine geophysics research.

## File Map

```
obsidian-web-clipper-templates/
├── sciencedirect-article.json     ← Elsevier / ScienceDirect
├── agu-article.json               ← AGU / Wiley Online Library
├── agu-article-old-style.json     ← Legacy AGU layout (archived)
├── springer-article.json          ← Springer Nature
├── science-org-article.json       ← Science / AAAS
├── gsw-article.json               ← GeoScienceWorld (Silverchair)
├── oup-article.json               ← Oxford Academic / OUP (Silverchair)
├── mdpi-article.json              ← MDPI (all journals)
├── tandf-article.json             ← Taylor & Francis Online (tandfonline.com) ⚠️ selectors need live verification
├── mathml-to-latex.user.js        ← Tampermonkey userscript: MathML → LaTeX pre-processor
└── fix_math.py                    ← Python post-processor: batch-fix MathML in clipped notes
```

## Template Schema

All templates use `schemaVersion: "0.1.0"` and share this output structure:

- **Vault path:** `Research/Literature`
- **Filename:** `Surname (Year).md` — conditional on author count (1 / 2 / 3+)
- **Frontmatter fields:** `title`, `authors` (multitext), `journal`, `volume`/`issue` or `volume_issue`, `date`/`published`, `doi`, `source_url`, `abstract`, `keywords` (multitext where available), `clipped_date`, `status: unread`, `tags`
- **Note body:** Abstract → (optional sections) → Article Content → References → My Notes

## Key Template Techniques

- `meta:name:citation_*` tags preferred over DOM selectors — more stable across redesigns
- `remove_html:figure`, `remove_html:div`, `remove_html:h2`, `remove_html:svg` for content cleanup
- `strip_attr:title` on Springer article content — citation `<a>` tags carry multiline `title` attributes that break markdown link syntax
- `{% if selectorHtml:X %}...{% endif %}` for optional sections (AGU Plain Language Summary, Science.org body fallback)
- `|split:", "|first` / `|last` chaining to extract fields from combined volume/date/pages strings
- `|slice:N,M` to detect author count (GSW uses this; MDPI uses adjacent sibling CSS meta tag selector)
- `selectorHtml:X|join:"\n\n"|markdown|trim` pattern to collapse multi-element arrays before markdown conversion
- `selector:.parent > .child` direct child combinator to exclude sibling noise (Springer author list, ORCID links)

## Publisher Notes

**ScienceDirect:** CSS selectors (`.Body`, `.figure.text-xs`, `ol.references`) may break on Elsevier HTML updates — re-inspect if a field stops populating.

**AGU/Wiley:** `.loa-authors-trunc` may truncate large author lists. References use `remove_html:div` to strip ADS/WoS/Scholar junk links.

**Springer:** Title extracted via `selector:.c-article-title` (not `{{title}}` preset — preset appends journal name). Published date uses positional `li:nth-child(3)` — may need adjustment for articles missing Received/Accepted dates.

**Science.org:** Article body selector `has([role="doc-acknowledgments"])` falls back to `{{content}}` preset if no acknowledgments section exists.

**GSW / OUP:** Both use the Silverchair platform — same author selectors (`.al-author-name .linked-name`) and same citation string parsing for pages.

**Taylor & Francis:** Verified live against `10.1080/1064119X.2018.1485066` (Marine Georesources & Geotechnology). Key findings:
- Metadata: Most fields use Dublin Core (`dc.Creator`, `dc.Date`, `dc.Subject`). Only `citation_journal_title` is static; all other `citation_*` tags are JS-injected and unavailable to the Web Clipper.
- Authors: `meta:name:dc.Creator` multitext. Count detection uses `.NLM_contrib-group .contribDegrees:nth-child(N)` (each author span has class `contribDegrees`).
- Abstract: `.hlFld-Abstract` ✅. `.abstractSection` does not exist on T&F pages.
- Keywords: `meta:name:dc.Subject|split:"; "` ✅.
- Volume/issue: Parsed from `.issue-heading` text node — `split:"Volume "|last|split:","|first` and `split:"Issue "|last|trim`.
- Pages: Not in any static meta tag or DOM element; field will be empty (produces bare `-`).
- Article body: `.hlFld-Fulltext` ✅.
- References: `ul.references` — the bibliography `<ul class="references numeric-ordered-list">` is in the DOM. Uses `remove_html:div` to strip `.extra-links` (WoS/Scholar buttons). Avoid `#references-Section1` — the `#` in template syntax is problematic.

**MDPI:** Trigger `mdpi.com/` is broad — fires on non-article pages but produces empty fields. Article number extracted from URL (`{{url|split:"/"|last}}`). Abstract and keywords appear twice in output (frontmatter + article content) — intentional.

## Output Integration

- **Dataview:** All frontmatter fields typed correctly (`text`, `multitext`, `date`) for querying
- **Zotero / Citations plugin:** `doi` field + `Surname (Year)` filename matches common citekey conventions
- **Status tracking:** `status: unread` supports reading pipeline queries

## Math Equation Handling

MathML in publisher HTML is not converted to LaTeX by the Web Clipper's `|markdown` filter. Two companion tools address this:

### `mathml-to-latex.user.js` (Tampermonkey userscript)
Install in Tampermonkey. Runs at `document-idle` on all 7 supported publisher domains. Modifies the DOM **before** the Web Clipper reads the page, so converted LaTeX flows through the existing templates unchanged.

Three-tier conversion strategy (in priority order):
1. **MathJax API** (`MathJax.startup.document.getMathItemsWithin`) — recovers the original source math (TeX or MathML) from MathJax's internal data. Most accurate; used whenever MathJax 3 is present.
2. **LaTeX annotation** (`<annotation encoding="application/x-tex">`) — extracts TeX source embedded in MathML by MathJax when rendering from TeX input.
3. **mathml-to-latex CDN library** (`@require` from jsDelivr) — full MathML parser; used when MathJax API is unavailable.
4. **Built-in recursive converter** — handles ~20 MathML element types (fractions, sub/superscripts, roots, accents, matrices, Greek letters, operators) as a last resort.

Inline `<math>` → `$...$`, display `<math display="block">` → `$$\n...\n$$`.

### `fix_math.py` (Python post-processor)
Requires `pandoc` on PATH. Scans vault markdown files for raw `<math>...</math>` HTML that survived the clip and converts via:
```
pandoc -f html -t markdown+tex_math_dollars --wrap=none
```
Usage:
```bash
python fix_math.py /path/to/vault       # scans Research/Literature/
python fix_math.py note.md              # single file
python fix_math.py --dry-run /vault     # preview without writing
```

## Development Approach

Templates are built by live DOM inspection on real article pages using browser DevTools. Each selector is verified against multiple articles before inclusion. Prefer `meta:name:citation_*` over DOM selectors wherever available.

Tested on: Marine Geology, G3, GRL, JGR, EPSL, JMSE — May 2026.

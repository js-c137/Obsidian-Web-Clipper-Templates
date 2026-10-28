# CLAUDE.md — obsidian-web-clipper-templates

## Project

A collection of 9 Obsidian Web Clipper JSON templates for clipping full-text scientific articles from major academic publishers, optimized for marine geophysics research.

## File Map

```
obsidian-web-clipper-templates/
├── sciencedirect-article.json     ← Elsevier / ScienceDirect
├── agu-article.json               ← AGU / Wiley Online Library
├── springer-article.json          ← Springer Nature
├── science-org-article.json       ← Science / AAAS
├── gsw-article.json               ← GeoScienceWorld (Silverchair)
├── oup-article.json               ← Oxford Academic / OUP (Silverchair)
├── mdpi-article.json              ← MDPI (all journals)
├── tandf-article.json             ← Taylor & Francis Online (tandfonline.com) ⚠️ selectors need live verification
├── ieee-article.json              ← IEEE Xplore (journals; conference papers untested)
├── ieee-prep.user.js              ← Tampermonkey userscript required by ieee-article.json (math, keywords, references)
├── iop-article.json               ← IOPscience / IOP Publishing
├── iop-prep.user.js               ← Tampermonkey userscript required by iop-article.json (math, references)
├── arxiv-article.json             ← arXiv HTML view (arxiv.org/html/…, LaTeXML)
├── arxiv-prep.user.js             ← Tampermonkey userscript required by arxiv-article.json (metadata, equations, footnotes, references)
├── mathml-to-latex.user.js        ← Tampermonkey userscript: MathML → LaTeX pre-processor
└── fix_math.py                    ← Python post-processor: batch-fix MathML in clipped notes
```

## Template Schema

All templates use `schemaVersion: "0.1.0"` and share this output structure:

- **Vault path:** `Research/Literature`
- **Filename:** `Surname (Year).md` — conditional on author count (1 / 2 / 3+)
- **Frontmatter fields (fixed order, identical in every template):** `title`, `authors` (multitext), `journal`, `volume`, `issue`, `pages`, `article_number`, `published` (date, always `|date:"YYYY-MM-DD"`), `doi`, `source_url`, `pdf_url`, `abstract`, `keywords` (multitext), then publisher extras (arXiv, IEEE), then `clipped_date` (date, `{{date|date:"YYYY-MM-DD"}}`), `status: unread`, `tags`. Missing data → empty value, never drop the key. One type per property name across all templates (Obsidian types are vault-wide). Do not reintroduce `date` or `volume_issue`.
- **Note body:** Abstract → (optional sections) → Article Content → References → My Notes

## Key Template Techniques

- **Triggers are regex** (`/^https?:\/\/(www\.)?host\/path\//`). The Clipper matches a plain-text trigger as a prefix of the full URL, so `mdpi.com/` never matches `https://www.mdpi.com/...`. Plain triggers are checked first, then regex triggers in template-list order; no match falls back to the top template. Avoid `schema:@Article` (too broad). `sciencedirect-alternate.json` has an empty trigger (manual only).
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

**AGU/Wiley:** `.loa-authors-trunc` may truncate large author lists. Early-2000s and current papers share the same Wiley layout (checked Oct 2026: GRL 2002 and 2025), so `agu-article.json` covers both; `agu-article-old-style.json` was removed (Oct 2026). `remove_html` deletes the element *with its text*: the old template's `remove_html:span` removed in-text citations (they sit in plain `<span>`), and its `li:nth-child(2)` author check never matched. Only `.paraNumber` spans are removed now. References use `remove_html:div` to strip ADS/WoS/Scholar junk links.

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

**IEEE Xplore:** Verified live against `10.1109/JSEN.2021.3126271` (IEEE Sensors Journal, doc 9614665), Oct 2026. Key findings:
- Metadata: No `citation_*` meta tags at all (only og/twitter). Angular SPA; metadata lives in `xplGlobal.document.metadata` (JS), so properties use rendered-DOM selectors.
- Title: `h1.document-title`. Authors: `.authors-info-container > .authors-info .blue-tooltip a > span` (multitext); count detection via `.authors-info:nth-child(N)` (container has only `.authors-info` element children).
- Journal / volume / issue: `.u-pb-1.stats-document-abstract-publishedIn > a`, `... > span > span:first-child` ("Volume: 22"), `a.stats-document-abstract-publishedIn-issue` ("Issue: 1"). The class `.stats-document-abstract-publishedIn` is also on the inner `<a>`, so always prefix `.u-pb-1`.
- Issue date / year: parsed from the "Published in" string (`split:", "|last|replace:")":""`). Fails for early-access articles and volume-only journals (no issue). `published_online` comes from `.doc-abstract-pubdate`.
- Pages: `.abstract-desktop-div .row > .col-6:first-child > .u-pb-1:first-child` (no class of its own). Article-number journals (e.g. TGRS "Article Sequence Number") are handled by an extra `replace`, unverified.
- Abstract: `.abstract-desktop-div .abstract-text-content` (a second copy exists in the mobile div; the prefix avoids duplicates).
- Keywords and references: only rendered when their accordions are opened, and the accordions are mutually exclusive. `ieee-prep.user.js` injects `meta[name=citation_keywords]` (Author Keywords), `meta[name=owc_ieee_keywords]` (IEEE Keywords) from `xplGlobal`, and a hidden `.owc-ieee-references` `<ol>` from `/rest/document/{id}/references`.
- Article body: `#article` (template falls back to `.document-text` to avoid `#`). Equations are MathJax v2 HTML-CSS (no MathML), TeX in `<script type="math/tex">` inside `<inline-formula>` / `<disp-formula>`. The userscript builds a hidden clone `.owc-ieee-body` with each formula replaced by `<math data-latex><semantics><annotation encoding="application/x-tex">`. The annotation child is required: Turndown drops an empty `<math>` as blank. `\begin{equation*}` wrappers are stripped (kept `align*`, `\tag`).
- Template uses `{% if selectorHtml:.owc-ieee-* %}` with a DOM fallback, so it still clips (without math, keywords or, unless the References accordion is open, references) when the userscript is not installed. All `.owc-*` selectors use classes, not ids.
- Full text needs institutional access; on abstract-only pages Article Content is empty.

**IOPscience:** Verified live against `10.1088/1361-6501/adbd66` (Measurement Science and Technology 36, 045102), Oct 2026. Key findings:
- Metadata: static `citation_*` tags for title, journal, volume, issue, firstpage (= IOP article number), DOI, authors. No `citation_publication_date` or `citation_keywords` on this article (keywords property stays empty); use `dc.date` ("2025-03-17") for date and year. `citation_author` metas are interleaved with `citation_author_institution`, so the sibling trick must use `~` (general sibling), not `+`.
- Authors: `span.nowrap[itemprop="author"] > span[itemprop="name"]` ("Given Surname"). A bare `span[itemprop="name"]` also matches the journal breadcrumb and a nav author list.
- Abstract: `.wd-jnl-art-abstract`. Body: `[itemprop="articleBody"]` (sections are `h2` + `div.article-text`; ends with Acknowledgment and Data availability).
- Figures: `figure.boxout` with nested `figure`; removed via `remove_html:"figure"`. Images are lazy (`data-src`).
- Equations: TeX in `span.tex > script[type="math/tex"]` (display: `mode=display`, inside `div.display-eqn`). MathJax 3.2.2 typesets lazily on scroll and consumes the script, so `iop-prep.user.js` first copies TeX from `MathJax.startup.document.math` onto each `span.tex` (data attributes), then falls back to the script, then to the inline placeholder image's `alt="$...$"`. Display TeX is `\begin{align}...\end{align}\tag{N}`; the script rewrites `align` → `aligned` when no `\tag` is inside the environment.
- References: lazy, only rendered after "Show References" (`.references li cite`). The userscript builds `.owc-iop-references` from the 30 `citation_reference` metas, and switches to the rendered `<cite>` list if References is opened.
- All formulas (121, 28 display) recovered both before and after MathJax typesetting.

**arXiv (HTML view):** Verified live against `arXiv:2604.19946v1` (cs.RO), Oct 2026. Key findings:
- Metadata: the LaTeXML HTML page has no meta tags at all (only viewport). Author line carries raw TeX macros (`Thomas Edridge\affilnum1 and Manon Kok\affilnum1`). `arxiv-prep.user.js` fetches `/abs/<id>` (same origin) and injects `citation_title`, `citation_author` (adjacent, "Surname, Given"), `citation_arxiv_id`, `citation_doi` (DataCite `10.48550/arXiv.<id>` unless the abs page gives one), `owc_date`, `owc_version`, `owc_primary_category`, `owc_subjects`, `owc_comments`, `owc_journal_ref`, `owc_journal_doi`. Keywords come from the paper's own `.ltx_classification` line → `citation_keywords`.
- Multi-value metas use `selector:meta[name="X"]?content` (array of attributes) for multitext and for first/last author surnames.
- Inline maths: every `<math>` has `<annotation encoding="application/x-tex">`, which the `|markdown` filter converts natively; no userscript needed for inline maths.
- Display maths: `table.ltx_equation` / `table.ltx_equationgroup` split each aligned row across `td` cells (each its own `<math>`, prefixed `\displaystyle`); the equation number is in `td.ltx_eqn_eqno`. The userscript emits one `$$ … \tag{n} $$` per row. `\bm` → `\boldsymbol` (MathJax 3 has no `\bm`).
- Body: `article.ltx_document > section.ltx_section` (plus `ltx_appendix`); front matter (title, authors, abstract, classification, runninghead/affiliation notes) excluded. Footnotes (`.ltx_note.ltx_role_footnote`) are moved to a Footnotes list at the end with `<sup>n</sup>` marks.
- References: `.ltx_bibliography li.ltx_bibitem`; the userscript drops the author-year label and the "Cited by: §…" block.
- Figures: `figure.ltx_figure` removed; `figure.ltx_table` (data tables) kept.
- Abstract-only `/abs/` pages are not covered (trigger is `/html/`).

**MDPI:** Trigger matches article pages only (`mdpi.com/<ISSN>/...`). Article number extracted from URL (`{{url|split:"/"|last}}`). Abstract and keywords appear twice in output (frontmatter + article content) — intentional.
Re-verified Oct 2026 against `10.3390/s25144511` (Sensors 25, 4511) after MDPI's HTML changed:
- Authors: `span[itemprop="author"]` no longer exists. Now `.art-authors .profile-card-drop` ("Given Surname"). `citation_author` metas are "Surname, Given".
- Keywords: `.html-keywords-link` class is gone (plain `<a>` inside `#html-keywords`). Now `meta:name:dc.subject` (no `citation_keywords` tag on MDPI).
- Body: `#article-contents` is gone. Now `.html-body` (sections only; `.html-back` holds contributions/funding/acknowledgements and is not clipped).
- References: `#html-references_list ol` (`ol.html-xx`); each item keeps its Google Scholar / CrossRef / Scilit links.
- Dates: `citation_publication_date` is now "2025/1" (year/month), which broke the `split:"-"` year. Use `dc.date` ("2025-07-21").
- Abstract: newer articles have a Highlights `<section type="highlights">` inside `#html-abstract`. Abstract uses `.html-p:not(section[type="highlights"] .html-p)`; Highlights get their own optional note section.
- Math: MathJax 2.7.1 with MathML input. The clippable MathML sits in `.MathJax > .MJX_Assistive_MathML > math`; `remove_html:"nobr,.MathJax_Preview"` drops the rendered glyph copy so each formula appears once.

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

Tested on: Marine Geology, G3, GRL, JGR, EPSL, JMSE — May 2026. IEEE Sensors Journal — Oct 2026 (selectors only; template not yet run through the Clipper).

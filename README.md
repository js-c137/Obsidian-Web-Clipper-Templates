# 📎 Obsidian Web Clipper Templates
### Scientific Literature Capture for Marine Geophysics Research

> Precision-engineered templates for clipping full-text scientific articles from **ScienceDirect**, **AGU/Wiley Online Library**, **Springer Nature**, **Science.org**, **GeoScienceWorld**, **Oxford Academic (OUP)**, and **MDPI** directly into Obsidian — with structured metadata, clean article content, and citation-ready references.

---

## Overview

These templates were built through iterative DOM inspection and live testing to extract the maximum structured information from paywalled and open-access scientific articles. They are optimized for marine geophysics and earth science literature but work for any article on the supported platforms.

Each template captures:
- **Frontmatter metadata** — title, authors, journal, volume, date, DOI, abstract, keywords
- **Full article body** — numbered sections with inline figures preserved in reading order
- **Clean references** — formatted citations with DOI links, junk links stripped
- **Personal note sections** — reading notes, key concepts, follow-up questions

Files are saved as `Surname (Year).md` for immediate Zotero/Citations plugin compatibility.

---

## Templates

### 1. `ScienceDirect Article`
**Trigger:** `sciencedirect.com/science/article`

| Property | Source | Notes |
|---|---|---|
| `title` | `{{title}}` | Preset variable |
| `authors` | `.author-group .react-xocs-alternative-link` | Handles `<button>` and `<a>` author types |
| `journal` | `.publication-volume .anchor-text\|first` | First anchor-text in header |
| `volume` | `.publication-volume .text-xs\|split:", "\|first` | First segment of combined field |
| `date` | `meta:name:citation_publication_date\|split:"/"\|join:"-"` | Reformatted to YYYY-MM-DD |
| `pages` | `.publication-volume .text-xs\|split:", "\|last` | Last segment of combined field |
| `doi` | `.doi` | CSS selector on visible DOI element |
| `abstract` | `.abstract.author` with `remove_html:h2` | Full text, not meta truncation |
| `keywords` | `.keywords-section .keyword span` | Returns array |

**Body sections:** Abstract → Highlights → Article Content (`.Body` with `remove_html:figure` and `remove_html:svg`) → Figure Captions (`.Body .figure.text-xs` with `remove_html:ol`) → References (`ol.references li`)

**Filename format:** `Watson et al. (2017).md`

---

### 2. `AGU Article`
**Trigger:** `agupubs.onlinelibrary.wiley.com/doi`, `onlinelibrary.wiley.com/doi`

| Property | Source | Notes |
|---|---|---|
| `title` | `{{title}}` | Preset variable |
| `authors` | `.loa-authors-trunc .author-name.accordion-tabbed__control` | Scoped to deduplicate DOM copies |
| `journal` | `meta:name:citation_journal_title` | Meta tag — stable across Wiley journals |
| `volume_issue` | `.volume-issue\|first` | e.g. `"Volume 20, Issue 1"` |
| `published` | `.epub-date` | e.g. `"21 December 2018"` |
| `doi` | `meta:name:citation_doi` | Clean DOI without URL prefix |
| `abstract` | `.article-section__abstract .article-section__content\|first` | Scoped to exclude Plain Language Summary |
| `keywords` | `.keywords .rlist--inline .badge-type` | Grandparent-scoped to avoid DOM duplicates |

**Body sections:** Abstract → Plain Language Summary *(conditional — omitted if absent)* → Article Content (`.article-section__full .article-section__content` joined) → References (`.article-section__references ul` with `remove_html:div` to strip ADS/WoS/Scholar junk links)

**Filename format:** `Searle et al. (2018).md`

---

### 3. `Springer Article`
**Trigger:** `link.springer.com/article`, `springer.com/article`

| Property | Source | Notes |
|---|---|---|
| `title` | `selector:.c-article-title` | DOM selector — avoids journal name suffix appended by `{{title}}` preset |
| `authors` | `.c-article-author-list__item > a` | Direct `<a>` child — strips ORCID and affiliation number siblings |
| `journal` | `meta:name:citation_journal_title` | Meta tag — clean and stable |
| `volume` | `meta:name:citation_volume` | Separate meta tag |
| `issue` | `meta:name:citation_issue` | Separate meta tag |
| `article_number` | `meta:name:citation_firstpage` | Springer uses article numbers, not page ranges |
| `published` | `.c-article-identifiers li:nth-child(3) time` | Third item in identifiers list = Published date |
| `doi` | `meta:name:citation_doi` | Clean DOI without URL prefix |
| `abstract` | `#Abs1-section .c-article-section__content` with `remove_html:figure` | Strips graphical abstract image and AI alt-text block |

**Body sections:** Abstract → Article Content (`.main-content` with `remove_html:figure` and `strip_attr:title`) → Figure Captions (`.c-article-section__figure[id^="figure-"]` joined, with `remove_html:span`, `remove_html:svg`, `remove_html:a`) → References (`.c-article-references__text` joined)

**Citation handling:** Springer encodes full reference text as `title` attributes on inline citation `<a>` tags. These contain newlines which break markdown link syntax in Obsidian. `strip_attr:title` removes the broken tooltips while preserving citation author-year text and keeping the reference list intact with DOI links.

**Figure captions note:** Figure captions include label and description text. Images and full-size links are excluded from the caption list due to parser limitations with URL-injection in filter chains. The figures appear inline within Article Content at their natural reading positions.

**Filename format:** `Fujii et al. (2018).md`

---

### 4. `Science.org Article`
**Trigger:** `science.org/doi`

| Property | Source | Notes |
|---|---|---|
| `title` | `{{title}}` | Preset variable |
| `authors` | `article header a[href^="#con"]` | Anchor links to contributor sections — ordered and deduplicated |
| `journal` | `meta:name:citation_journal_title` | Meta tag |
| `volume_issue` | `article header nav a[href*="/toc/"]\|first` | Combined volume/issue from nav link |
| `published` | `article header .core-date-published` | e.g. `"3 January 2020"` |
| `doi` | `article header a[href^="https://doi.org/10."]\|first\|split:"DOI: "\|last` | Extracted from visible DOI link |

**Body sections:** Abstract (`#abstract` with heading tags removed) → Article Content (`.core-container:has([role="doc-acknowledgments"])` with `remove_html:figure` — conditional fallback to `{{content}}` preset for simpler article layouts) → References (`#bibliography .label` and `.citation-content` joined)

**Author count detection:** Checks for `article header a[href="#con3"]` (3rd contributor link) then `a[href="#con2"]` — each contributor has a sequential anchor `#con1`, `#con2`, etc.

**Filename format:** `Smith et al. (2020).md`

---

### 5. `GeoScienceWorld Article`
**Trigger:** `pubs.geoscienceworld.org`

| Property | Source | Notes |
|---|---|---|
| `title` | `{{title}}` | Preset variable |
| `authors` | `.al-author-name .linked-name` | Author name links in header |
| `journal` | `meta:name:citation_journal_title` | Meta tag |
| `volume` | `meta:name:citation_volume` | Meta tag |
| `issue` | `meta:name:citation_issue` | Meta tag |
| `pages` | `.ww-citation-primary\|split:": "\|last\|split:"."\|first` | Extracted from citation string — splits after colon, strips trailing period |
| `doi` | `meta:name:citation_doi` | Meta tag |
| `abstract` | `section.abstract` with `remove_html:h2` | Strips "Abstract" heading, keeps full text |
| `date` | `meta:name:citation_publication_date\|split:"/"\|join:"-"` | Reformatted to YYYY-MM-DD |

**Body sections:** Abstract → Article Content (`.article-body` with `remove_html:figure`) → References (`.ref-list .ref-content` joined)

**Author count detection:** Uses `|slice:2,3` to test for a third author — if the slice returns a value, `et al.` is used.

**Filename format:** `Chen et al. (2023).md`

---

### 6. `Oxford Academic (OUP) Article`
**Trigger:** `academic.oup.com`

| Property | Source | Notes |
|---|---|---|
| `title` | `{{title}}` | Preset variable |
| `authors` | `.al-author-name .linked-name` | Same class as GeoScienceWorld — both use Silverchair platform |
| `journal` | `meta:name:citation_journal_title` | Meta tag |
| `volume` | `meta:name:citation_volume` | Meta tag |
| `issue` | `meta:name:citation_issue` | Meta tag |
| `pages` | `.ww-citation-primary\|split:"Pages "\|last\|split:","\|first` | Extracted from citation string |
| `doi` | `meta:name:citation_doi` | Meta tag |
| `abstract` | `section.abstract` with `remove_html:h2` | Strips "Abstract" heading |
| `keywords` | `.kwd-group .kwd-main` | Returns array |
| `date` | `meta:name:citation_publication_date\|split:"/"\|join:"-"` | Reformatted to YYYY-MM-DD |

**Body sections:** Abstract → Article Content (`{{content}}` preset — OUP article body is cleanly extractable without CSS targeting) → References (`.ref-list .mixed-citation` joined)

**Author count detection:** Uses `:nth-child(3)` and `:nth-child(2)` on `.al-authors-list` to test for 3rd and 2nd authors respectively.

**Filename format:** `Tivey et al. (2021).md`

---

### 7. `MDPI Article`
**Trigger:** `mdpi.com/`

| Property | Source | Notes |
|---|---|---|
| `title` | `selector:h1` | DOM selector — `{{title}}` appends journal name on MDPI |
| `authors` | `span[itemprop="author"] span[itemprop="name"]` | Schema.org name spans scoped to author context |
| `journal` | `meta:name:citation_journal_title` | Meta tag |
| `volume` | `meta:name:citation_volume` | Meta tag |
| `issue` | `meta:name:citation_issue` | Meta tag |
| `article_number` | `{{url\|split:"/"\|last}}` | Last URL segment — MDPI has no `citation_firstpage` meta tag |
| `published` | `meta:name:citation_publication_date` | Format `YYYY-MM-DD` |
| `doi` | `meta:name:citation_doi` | Meta tag |
| `abstract` | `#html-abstract .html-p` | Paragraph div inside abstract section |
| `keywords` | `#html-keywords .html-keywords-link` | Keyword anchor elements |

**Body sections:** Abstract → Keywords → Article Content (`#article-contents` — MDPI renders the complete article on the abstract page, including inline figures with full HTTPS image URLs, captions, and a numbered reference list)

**Author count detection:** Uses CSS adjacent sibling selector on `<head>` meta tags — `meta[name="citation_author"] + meta[name="citation_author"] + meta[name="citation_author"]` reliably detects 3+ authors because MDPI groups all citation_author meta tags consecutively.

**Image notes:** MDPI figure images use full HTTPS CDN URLs (`mdpi-res.com`) and load directly in Obsidian without any URL fixing. Figures appear inline within Article Content at their reading positions.

**Filename format:** `Zhao et al. (2025).md`

---

## Template Comparison

| Feature | ScienceDirect | AGU/Wiley | Springer | Science.org | GSW | OUP | MDPI |
|---|---|---|---|---|---|---|---|
| Title | ✅ preset | ✅ preset | ✅ DOM selector | ✅ preset | ✅ preset | ✅ preset | ✅ DOM selector |
| Authors (ordered) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Journal | ✅ | ✅ meta | ✅ meta | ✅ meta | ✅ meta | ✅ meta | ✅ meta |
| Volume/Issue | ✅ split | ✅ combined | ✅ separate | ✅ combined | ✅ separate | ✅ separate | ✅ separate |
| Published date | ✅ meta | ✅ DOM | ✅ DOM positional | ✅ DOM | ✅ meta | ✅ meta | ✅ meta |
| DOI | ✅ DOM | ✅ meta | ✅ meta | ✅ DOM split | ✅ meta | ✅ meta | ✅ meta |
| Abstract (full) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Keywords | ✅ | ✅ | ❌ not in HTML | ❌ | ❌ | ✅ | ✅ |
| Highlights | ✅ | — | — | — | — | — | — |
| Plain Language Summary | — | ✅ conditional | — | — | — | — | — |
| Article Content | ✅ sections | ✅ sections | ✅ clean text | ✅ conditional | ✅ body | ✅ preset | ✅ full page |
| Inline figures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ HTTPS |
| Separate figure list | ✅ | — | ✅ labels only | — | — | — | — |
| References | ✅ | ✅ no junk links | ✅ with DOI | ✅ | ✅ | ✅ | ✅ numbered |
| Filename format | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` |

---

## Installation

1. Install the [Obsidian Web Clipper](https://obsidian.md/clipper) browser extension
2. Open the extension → **gear icon** → **Templates** → **New Template**
3. Click the **`...`** menu → **Import** (or paste JSON directly if your version supports it)
4. Paste the contents of the relevant `.json` template file
5. Navigate to a supported article page — the template auto-triggers on URL match

---

## Requirements

| Requirement | Details |
|---|---|
| Obsidian Web Clipper | v1.0.0 or later (for conditional logic support) |
| Obsidian | v1.7.2 or later |
| Browser | Chrome, Firefox, Safari, Edge, Brave, Arc |
| Access | Full-text institutional or open-access required for article body |

---

## Known Limitations

- **ScienceDirect CSS selectors** — `.Body`, `.figure.text-xs`, `.Bibliography` etc. may break if Elsevier updates their HTML structure. Re-inspect and update the affected class name in the template editor if a field stops populating.

- **AGU author count** — the `.loa-authors-trunc` container may truncate very large author lists. If authors are missing, inspect the full author list container and update the parent selector.

- **AGU Plain Language Summary** — rendered conditionally using `{% if %}` logic. Requires Web Clipper ≥ v1.0.0.

- **Springer citation links** — inline citation `<a>` tags carry multiline `title` attributes containing the full reference text, which break markdown link syntax. `strip_attr:title` removes all title attributes from the article content, which cleans up the links but also removes any other title-based tooltips.

- **Springer figure images** — figure images are not rendered in the Figure Captions section due to parser limitations (injecting `https:` into `//`-prefixed protocol-relative URLs requires `split/join` after `|markdown`, a chain that causes empty output). Figures do appear inline in Article Content. As a workaround, add a CSS snippet to your vault to constrain figure image widths: `.markdown-preview-view img { max-width: 600px; }`.

- **Springer published date** — uses positional selector `.c-article-identifiers li:nth-child(3)` which assumes "Published" is always the third item in the identifiers list. Articles without a "Received" or "Accepted" entry may return the wrong value — inspect and adjust the index if needed.

- **Springer keywords** — Springer Nature does not expose keywords in the HTML. This field is absent from the Springer template.

- **Science.org article body** — uses a `has([role="doc-acknowledgments"])` CSS selector to target the main content container. If the article lacks an acknowledgments section, the template falls back to the `{{content}}` preset, which may include navigation and sidebar content.

- **GeoScienceWorld / OUP pages** — extracted from the visible `.ww-citation-primary` citation string using `split/join` chaining. If the citation format changes (e.g. for Advance Articles without page numbers), the field may return an unexpected value.

- **OUP article body** — uses the `{{content}}` preset, which works cleanly for most Oxford Academic articles. For articles with complex supplementary layouts, some peripheral content may be included.

- **MDPI article content** — `#article-contents` includes the full article from abstract through references on a single page. The abstract and keywords therefore appear both in their dedicated frontmatter sections at the top of the note and again inline within Article Content. This is intentional — the dedicated sections provide clean frontmatter while the article content provides the full reading experience.

- **MDPI trigger breadth** — the trigger `mdpi.com/` fires on all MDPI pages including journal homepages, author pages, and search results. The template fields will simply return empty on non-article pages; no notes will be created unless the clipper is manually triggered.

---

## File Structure

```
obsidian-web-clipper-templates/
├── README.md                          ← this file
├── sciencedirect-article.json         ← ScienceDirect / Elsevier
├── agu-article.json                   ← AGU / Wiley Online Library
├── springer-article.json              ← Springer Nature
├── science-org-article.json           ← Science / AAAS
├── gsw-article.json                   ← GeoScienceWorld
├── oup-article.json                   ← Oxford Academic (OUP)
├── mdpi-article.json                  ← MDPI (all journals)
└── agu-article-old-style.json         ← Legacy AGU layout (archived)
```

---

## Vault Integration

All templates save to `Research/Literature` and are designed for use with:

- **Dataview** — all frontmatter fields are typed correctly (`text`, `multitext`, `date`) for querying
- **Zotero / Citations plugin** — `doi` field enables citekey linking; filename format `Surname (Year)` matches common citekey conventions
- **Status tracking** — `status: unread` field supports reading pipeline queries

Example Dataview query to list unread papers by journal:

```dataview
TABLE authors, journal, published, doi
FROM "Research/Literature"
WHERE status = "unread"
SORT published DESC
```

---

## Development Notes

These templates were built by iterative live DOM inspection on real article pages using browser DevTools console queries. Each selector was verified against multiple articles before inclusion. The approach prioritizes CSS selector variables over preset variables (`{{author}}`, `{{description}}`) wherever the preset variables were found to truncate or fail on these specific platforms.

Key techniques used:

- `selectorHtml` + `|markdown|trim` for full HTML-to-Markdown conversion of rich content blocks
- `|join:"\n\n"` to collapse multi-element arrays before markdown conversion (avoids `["...", "..."]` array notation in output)
- `remove_html:div` on reference list containers to strip database link blocks (ADS, Web of Science, Google Scholar) while preserving citation text and DOI links (AGU)
- `remove_html:figure` to strip inline figure containers from article body text, keeping body text clean (ScienceDirect, Springer, GSW, Science.org)
- `remove_html:h2` to strip section headings from abstract containers that include them
- `strip_attr:title` to remove tooltip text from citation links where `title` attributes contain newlines that break markdown link syntax (Springer)
- `|split:", "|slice:N,M|join` chaining to extract individual components from combined volume/date/pages strings
- Direct child combinator `selector:.parent > .child` to target specific elements while excluding adjacent siblings (Springer author list)
- `|slice:N,M` to detect whether an Nth author exists — used for 1/2/3+ author branching in GeoScienceWorld
- `meta[name="citation_author"] + meta[name="citation_author"] + meta[name="citation_author"]` — CSS adjacent sibling selector on consecutive meta tags to count authors without DOM traversal (MDPI); confirmed reliable because MDPI groups all citation_author meta tags consecutively in `<head>`
- `span[itemprop="author"] span[itemprop="name"]` — Schema.org microdata selectors as an alternative to class-based author selectors where classes are dynamically generated (MDPI)
- `{{url|split:"/"|last}}` — URL decomposition to extract the article number from the URL path when no `citation_firstpage` meta tag is available (MDPI)
- `{% if selectorHtml:X %}...{% endif %}` conditional blocks to suppress empty optional sections (AGU Plain Language Summary, Science.org body selector fallback)
- `meta:name:citation_*` tags as preferred source over DOM selectors wherever available — more stable across site redesigns

---

*Templates tested on: Marine Geology, Geochemistry Geophysics Geosystems, Geophysical Research Letters, Journal of Geophysical Research, Earth and Planetary Science Letters, Journal of Marine Science and Engineering — May 2026*

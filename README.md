# 📎 Obsidian Web Clipper Templates
### Scientific Literature Capture for Marine Geophysics Research

> Precision-engineered templates for clipping full-text scientific articles from **ScienceDirect**, **AGU/Wiley Online Library**, and **Springer Nature** directly into Obsidian — with structured metadata, clean article content, and citation-ready references.

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
| `journal` | `.publication-header .anchor-text\|first` | First anchor-text in header |
| `volume` | `.publication-volume .text-xs\|split:", "\|first` | Split from combined field |
| `date` | `.publication-volume .text-xs\|split:", "\|slice:1,2` | Mid-segment of combined field |
| `pages` | `.publication-volume .text-xs\|split:", "\|last` | Last segment of combined field |
| `doi` | `.doi` | CSS selector on visible DOI element |
| `abstract` | `.abstract.author` (full DOM) | Full text, not meta truncation |
| `keywords` | `.keywords-section .keyword span` | Returns array |

**Body sections:** Abstract → Highlights → Article Content (`.Body section`) → Figures (`.Body .figure.text-xs`) → References (`.Bibliography`)

**Filename format:** `Watson (2017).md`

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

**Body sections:** Abstract → Plain Language Summary *(conditional — omitted if absent)* → Article Content (`.article-section__full .article-section__content`) → References (`.article-section__references ul` with `remove_html:div` to strip ADS/WoS/Scholar junk links)

**Filename format:** `Searle (2018).md`

---

### 3. `Springer Article`
**Trigger:** `link.springer.com/article`, `springer.com/article`

| Property | Source | Notes |
|---|---|---|
| `title` | `selector:.c-article-title` | DOM selector — avoids journal name suffix appended by `{{title}}` preset |
| `authors` | `.c-article-author-list__item > a` | Direct `<a>` child — strips ORCID and affiliation number junk from sibling elements |
| `journal` | `meta:name:citation_journal_title` | Meta tag — clean and stable |
| `volume` | `meta:name:citation_volume` | Separate meta tag |
| `issue` | `meta:name:citation_issue` | Separate meta tag |
| `article_number` | `meta:name:citation_firstpage` | Springer uses article numbers not page ranges |
| `published` | `.c-article-identifiers li:nth-child(3) time` | Index 2 in identifiers list = Published date |
| `doi` | `meta:name:citation_doi` | Clean DOI without URL prefix |
| `abstract` | `#Abs1-section .c-article-section__content` with `remove_html:figure` | Strips graphical abstract image and AI alt-text block |
| `keywords` | — | Not available in Springer Nature HTML |

**Body sections:** Abstract → Article Content (`.main-content` with `strip_attr:title`) → References (`.c-article-references__text`)

**Citation handling:** Springer encodes full reference text as `title` attributes on inline citation `<a>` tags. These contain newlines which break markdown link syntax in Obsidian. `strip_attr:title` removes the broken tooltips while preserving clean citation text (e.g. `Elderfield and Schultz 1996`) and keeping the reference list intact with DOI links at the end of the note.

**Filename format:** `Fujii (2018).md`

---

## Template Comparison

| Feature | ScienceDirect | AGU/Wiley | Springer |
|---|---|---|---|
| Title | ✅ | ✅ | ✅ DOM selector |
| Authors (ordered) | ✅ | ✅ | ✅ |
| Journal | ✅ | ✅ meta | ✅ meta |
| Volume/Issue | ✅ split | ✅ combined | ✅ separate meta |
| Published date | ✅ | ✅ | ✅ |
| DOI | ✅ | ✅ meta | ✅ meta |
| Abstract (full) | ✅ | ✅ | ✅ |
| Keywords | ✅ | ✅ | ❌ not in HTML |
| Highlights | ✅ | — | — |
| Plain Language Summary | — | ✅ conditional | — |
| Article Content | ✅ sections | ✅ sections | ✅ clean text |
| Inline citations | clean text | clean text | clean unlinked |
| Inline figures | ✅ | ✅ | ✅ |
| References | ✅ DOI only | ✅ DOI only | ✅ with DOI |
| Filename | `Surname (Year)` | `Surname (Year)` | `Surname (Year)` |

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

- **ScienceDirect CSS selectors** (`.Body`, `.figure.text-xs`, `.Bibliography`, etc.) may break if Elsevier updates their HTML structure. Re-inspect and update the affected class name in the template editor if a field stops populating.
- **AGU author count** — the `.loa-authors-trunc` container may truncate very large author lists. If authors are missing, inspect the full author list container and update the parent selector.
- **Plain Language Summary (AGU)** — rendered conditionally using `{% if %}` logic. Requires Web Clipper ≥ v1.0.0. On older versions, an empty section may appear — this is cosmetic only.
- **Inline figures** — rendered at their natural reading position within article content. A separate Figures section is provided in the ScienceDirect template for quick reference. Figure images use relative URLs from Elsevier/Wiley/Springer CDN and require an active browser session to display.
- **Keywords** — AGU keyword count is dynamic per article; the selector is scoped to avoid DOM duplicates but keyword count will vary. Springer Nature does not expose keywords in the HTML — this field is absent from the Springer template.
- **Springer citation links** — inline citation hyperlinks are removed by `strip_attr:title` because Springer encodes full reference text with newlines in the `title` attribute, which breaks markdown link syntax. Citations remain readable as plain author-year text (e.g. `Fujii et al. 2016`). Full references with DOI links are preserved in the References section.
- **Springer published date** — uses positional selector `.c-article-identifiers li:nth-child(3)` which assumes "Published" is always the third item. Articles without a "Received" date may return the wrong value — inspect and adjust the index if needed.

---

## File Structure

```
obsidian-web-clipper-templates/
├── README.md                          ← this file
├── sciencedirect-article.json         ← ScienceDirect template
├── agu-article.json                   ← AGU / Wiley Online Library template
└── springer-article.json              ← Springer Nature template
```

---

## Vault Integration

All three templates save to configurable paths and are designed for use with:

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
- `|join:"\n\n"` to collapse multi-element arrays before markdown conversion (avoids `["...", "..."]` array notation)
- `remove_html:div` on reference list containers to strip database link blocks (ADS, Web of Science, Google Scholar) while preserving citation text and DOI links
- `remove_html:figure` to strip graphical abstract images and AI-generated alt text blocks (Springer)
- `strip_attr:title` to remove tooltip text from citation links where `title` attributes contain newlines that break markdown link syntax (Springer)
- `|first` to deduplicate fields where the DOM contains multiple copies of the same element
- `|split:", "|slice:1,2|join` chaining to extract individual components from combined volume/date/pages strings
- `selector:.c-article-author-list__item > a` direct child combinator to target only the name `<a>` tag and exclude sibling ORCID and affiliation elements (Springer)
- `meta:name:citation_*` tags as preferred source over DOM selectors wherever available — more stable across site updates
- `{% if %}` conditional blocks to suppress empty optional sections

---

*Templates tested on: Marine Geology, Geochemistry Geophysics Geosystems, Geophysical Research Letters, Marine and Petroleum Geology, Earth Planets and Space — April 2026*
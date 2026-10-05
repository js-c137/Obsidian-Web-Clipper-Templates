---
name: project-overview
description: Collection of 7 Obsidian Web Clipper JSON templates for clipping scientific articles from major academic publishers
metadata:
  type: project
---

**Fact:** This repo contains 7 Obsidian Web Clipper templates (JSON format, schemaVersion 0.1.0) for capturing scientific articles from: ScienceDirect, AGU/Wiley, Springer Nature, Science.org, GeoScienceWorld (GSW), Oxford Academic (OUP), and MDPI. There is also one archived legacy template (agu-article-old-style.json).

**Why:** Templates are used for marine geophysics literature management in Obsidian. Each template is precision-engineered via live DOM inspection to extract structured metadata (frontmatter) and full article content including figures and references.

**How to apply:** All templates share the same output schema: `Research/Literature` vault path, filename `Surname (Year).md`, frontmatter with title/authors/journal/volume/doi/abstract/keywords/status/tags/clipped_date, and note body with Abstract → Article Content → References → My Notes sections. Key techniques include CSS selector variables, `remove_html`, `strip_attr`, `split/join` chaining, `{% if %}` conditional blocks, and `meta:name:citation_*` meta tags as stable selectors. Templates tested on real articles as of May 2026.

Two companion math tools exist alongside the JSON templates:
- `mathml-to-latex.user.js` — Tampermonkey userscript that pre-processes MathML to LaTeX in the DOM before clipping (MathJax API → annotation extraction → CDN library → built-in converter)
- `fix_math.py` — Python/pandoc batch post-processor for fixing MathML that survived into clipped notes

// ==UserScript==
// @name         IOPscience → Obsidian Web Clipper prep
// @namespace    obsidian-web-clipper-templates
// @version      1.0.0
// @description  Builds hidden, clip-ready copies of the IOPscience abstract, full text (TeX scripts → LaTeX) and reference list, for use with iop-article.json.
// @match        https://iopscience.iop.org/article/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Why this exists
 * ---------------
 * IOPscience ships every equation as TeX inside <span class="tex"><script type="math/tex">
 * (display: type="math/tex; mode=display"), next to a placeholder image. There is no
 * MathML, so mathml-to-latex.user.js has nothing to convert, and the Web Clipper's
 * |markdown filter drops <script>, so equations vanish from the clip.
 * References are only rendered after "Show References" is clicked.
 *
 * What it does (the visible page is not modified)
 *   - .owc-iop-body        hidden clone of [itemprop="articleBody"], each span.tex replaced
 *                          by <math><annotation encoding="application/x-tex">, which the
 *                          |markdown filter turns into $...$ / $$...$$
 *   - .owc-iop-abstract    same treatment for the abstract
 *   - .owc-iop-references  hidden <ol>: the rendered <cite> list once References is open,
 *                          otherwise built from the citation_reference meta tags
 */

(function () {
  'use strict';

  const OWC = 'owc-iop';
  const MML = 'http://www.w3.org/1998/Math/MathML';
  let lastKey = null;
  let lastBodySig = '';
  let lastRefSource = '';

  // ---------- container ----------

  function container() {
    let box = document.querySelector('div.' + OWC + '-container');
    if (!box) {
      box = document.createElement('div');
      box.className = OWC + '-container';
      box.hidden = true;
      box.setAttribute('aria-hidden', 'true');
      document.body.appendChild(box);
    }
    return box;
  }

  function replaceBlock(cls, node) {
    const box = container();
    const old = box.querySelector('.' + cls);
    node.classList.add(cls);
    if (old) old.replaceWith(node);
    else box.appendChild(node);
  }

  // ---------- math ----------

  // Make display TeX safe inside $$...$$ (Obsidian MathJax):
  //  - tidy "\tag{ 1 }"
  //  - drop equation / equation* wrappers
  //  - align / align* without an inner \tag -> aligned (an align env inside $$ can error)
  function cleanDisplayTex(tex) {
    let t = tex.replace(/\\tag\{\s*([^}]*?)\s*\}/g, '\\tag{$1}').trim();
    t = t.replace(/^\\begin\{(equation\*?)\}([\s\S]*)\\end\{\1\}/, '$2').trim();
    t = t.replace(/\\begin\{(align\*?)\}([\s\S]*?)\\end\{\1\}/g, (m, env, inner) =>
      /\\tag\{/.test(inner) ? m : '\\begin{aligned}' + inner + '\\end{aligned}');
    return t.trim();
  }

  function mathNode(tex, block) {
    const m = document.createElementNS(MML, 'math');
    if (block) m.setAttribute('display', 'block');
    m.setAttribute('data-latex', tex);
    const sem = document.createElementNS(MML, 'semantics');
    const ann = document.createElementNS(MML, 'annotation');
    ann.setAttribute('encoding', 'application/x-tex');
    ann.textContent = tex; // non-empty child: Turndown drops an empty <math> as "blank"
    sem.appendChild(ann);
    m.appendChild(sem);
    return m;
  }

  // MathJax 3 typesets lazily as you scroll and consumes the <script> it renders.
  // Before cloning, copy each typeset formula's TeX source onto its live span.tex
  // (data attributes only; nothing visible changes).
  function tagLiveMath() {
    let items;
    try {
      items = window.MathJax && MathJax.startup && MathJax.startup.document && MathJax.startup.document.math;
    } catch (e) {
      return;
    }
    if (!items) return;
    for (const item of items) {
      const root = item.typesetRoot;
      const span = root && root.closest && root.closest('span.tex');
      if (!span || span.dataset.owcTex) continue;
      span.dataset.owcTex = String(item.math || '');
      span.dataset.owcDisplay = item.display ? '1' : '0';
    }
  }

  function texSource(span) {
    if (span.dataset.owcTex) return { tex: span.dataset.owcTex, block: span.dataset.owcDisplay === '1' };
    const s = span.querySelector('script[type^="math/tex"]');
    if (s && s.textContent.trim()) return { tex: s.textContent, block: /mode=display/.test(s.type) };
    // Inline placeholder images carry the TeX in alt="$...$"
    const img = span.querySelector('.texImage img[alt^="$"]');
    if (img) return { tex: img.getAttribute('alt').replace(/^\$+|\$+$/g, ''), block: false };
    return null;
  }

  function convertMath(root) {
    root.querySelectorAll('span.tex').forEach((span) => {
      const src = texSource(span);
      if (!src || !src.tex.trim()) return;
      const block = src.block || !!span.closest('.display-eqn');
      const raw = src.tex.trim();
      span.replaceWith(mathNode(block ? cleanDisplayTex(raw) : raw, block));
    });
    // Anything MathJax 3 may have rendered, and leftovers
    root.querySelectorAll('mjx-container, .texImage, script').forEach((n) => n.remove());
  }

  // ---------- body / abstract ----------

  function cleanBody(root) {
    convertMath(root);
    // In-page anchors (citations, equations, sections, figures): keep the text only
    root.querySelectorAll('a[href^="#"]').forEach((a) => a.replaceWith(document.createTextNode(a.textContent)));
    // Figure UI noise; figures themselves are removed by the template (remove_html:"figure")
    root.querySelectorAll('.zoom-tools, button, .fig-dwnld-std-img, .fig-dwnld-hi-img').forEach((n) => n.remove());
    // Lazy images: promote data-src so figures work if you drop remove_html:"figure"
    root.querySelectorAll('img[data-src]').forEach((img) => img.setAttribute('src', img.getAttribute('data-src')));
    root.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    return root;
  }

  function buildBody() {
    const art = document.querySelector('[itemprop="articleBody"]');
    if (!art) return;
    const sig = art.querySelectorAll('*').length + ':' + art.textContent.length;
    if (sig === lastBodySig && container().querySelector('.' + OWC + '-body')) return;
    lastBodySig = sig;
    const clone = cleanBody(art.cloneNode(true));
    const wrap = document.createElement('div');
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    replaceBlock(OWC + '-body', wrap);
  }

  function buildAbstract() {
    const abs = document.querySelector('.wd-jnl-art-abstract');
    if (!abs || container().querySelector('.' + OWC + '-abstract')) return;
    const clone = abs.cloneNode(true);
    convertMath(clone);
    const wrap = document.createElement('div');
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    replaceBlock(OWC + '-abstract', wrap);
  }

  // ---------- references ----------

  function parseRefMeta(content) {
    const f = {};
    content.split(/;\s*(?=citation_\w+=)/).forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 0) return;
      const k = pair.slice(0, i).trim();
      const v = pair.slice(i + 1).replace(/;\s*$/, '').trim();
      if (!v) return;
      (f[k] = f[k] || []).push(v);
    });
    return f;
  }

  function refFromMeta(content) {
    const f = parseRefMeta(content);
    const g = (k) => (f[k] ? f[k][0] : '');
    const parts = [];
    if (f.citation_author) parts.push(f.citation_author.join(', '));
    if (g('citation_publication_date')) parts.push(g('citation_publication_date'));
    if (g('citation_title')) parts.push(g('citation_title'));
    let src = g('citation_journal_title') || g('citation_book_title') || g('citation_publisher');
    if (g('citation_volume')) src += ' ' + g('citation_volume');
    const pages = [g('citation_firstpage'), g('citation_lastpage')].filter(Boolean).join('–');
    if (pages) src += ' ' + pages;
    if (src.trim()) parts.push(src.trim());
    let text = parts.join(' ');
    if (g('citation_doi')) text += ' doi:' + g('citation_doi');
    return text;
  }

  function buildReferences() {
    const cites = document.querySelectorAll('.references li cite');
    const metas = document.querySelectorAll('meta[name="citation_reference"]');
    const source = cites.length ? 'dom:' + cites.length : metas.length ? 'meta:' + metas.length : '';
    if (!source || source === lastRefSource) return;
    lastRefSource = source;
    const ol = document.createElement('ol');
    if (cites.length) {
      cites.forEach((c) => {
        const li = document.createElement('li');
        const clone = c.cloneNode(true);
        convertMath(clone);
        while (clone.firstChild) li.appendChild(clone.firstChild);
        const doi = c.closest('li') && c.closest('li').getAttribute('doi');
        if (doi && !/doi/i.test(li.textContent)) li.appendChild(document.createTextNode(' doi:' + doi));
        ol.appendChild(li);
      });
    } else {
      metas.forEach((m) => {
        const li = document.createElement('li');
        li.textContent = refFromMeta(m.getAttribute('content') || '');
        ol.appendChild(li);
      });
    }
    replaceBlock(OWC + '-references', ol);
  }

  // ---------- main loop ----------

  function tick() {
    const doi = document.querySelector('meta[name="citation_doi"]');
    const key = (doi && doi.getAttribute('content')) || location.pathname;
    if (key !== lastKey) {
      lastKey = key;
      lastBodySig = lastRefSource = '';
      const box = document.querySelector('div.' + OWC + '-container');
      if (box) box.textContent = '';
    }
    tagLiveMath();
    buildAbstract();
    buildBody();
    buildReferences();
  }

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(tick, 800);
  };
  new MutationObserver((muts) => {
    if (muts.every((m) => m.target.closest && m.target.closest('div.' + OWC + '-container'))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();

// ==UserScript==
// @name         IEEE Xplore → Obsidian Web Clipper prep
// @namespace    obsidian-web-clipper-templates
// @version      1.0.0
// @description  Builds hidden, clip-ready copies of the IEEE Xplore abstract, full text (MathJax v2 → LaTeX) and reference list, and injects keyword meta tags, for use with ieee-article.json.
// @match        https://ieeexplore.ieee.org/document/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Why this exists
 * ---------------
 * IEEE Xplore is an Angular app with no static citation_* meta tags. Three things the
 * Web Clipper cannot get from the live DOM on its own:
 *   1. Equations: IEEE renders TeX with MathJax v2 (HTML-CSS output). There is no MathML
 *      for the existing mathml-to-latex.user.js to work with. The TeX source sits in
 *      <script type="math/tex"> inside <inline-formula> / <disp-formula>.
 *   2. Keywords: only rendered when the "Keywords" accordion is opened.
 *   3. References: only rendered when the "References" accordion is opened, and the
 *      accordions are mutually exclusive (opening one closes the other).
 *
 * What it does (the visible page is not modified)
 *   - .owc-ieee-body       hidden clone of the full text, formulas replaced by
 *                          <math><annotation encoding="application/x-tex">, which the
 *                          Web Clipper |markdown filter turns into $...$ / $$...$$
 *   - .owc-ieee-abstract   same treatment for the abstract
 *   - .owc-ieee-references hidden <ol> built from /rest/document/{id}/references
 *   - <meta name="citation_keywords">  one per Author Keyword
 *   - <meta name="owc_ieee_keywords">  one per IEEE Keyword
 * All injected nodes carry data-owc-article so stale data is replaced on SPA navigation.
 */

(function () {
  'use strict';

  const OWC = 'owc-ieee';
  let lastArticle = null;
  let lastBodySig = '';
  let lastAbsSig = '';
  let busy = false;

  // ---------- helpers ----------

  function meta() {
    try {
      return window.xplGlobal && window.xplGlobal.document && window.xplGlobal.document.metadata;
    } catch (e) {
      return null;
    }
  }

  function articleNumber() {
    const m = meta();
    if (m && m.articleNumber) return String(m.articleNumber);
    const hit = location.pathname.match(/\/document\/(\d+)/);
    return hit ? hit[1] : null;
  }

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
    node.setAttribute('data-owc-article', lastArticle || '');
    if (old) old.replaceWith(node);
    else box.appendChild(node);
  }

  // ---------- math ----------

  function texOf(formula) {
    const s = formula.querySelector('script[type^="math/tex"]');
    if (s && s.textContent.trim()) return s.textContent.trim();
    const t = formula.querySelector('span.tex');
    if (t && t.textContent.trim()) return t.textContent.trim();
    return '';
  }

  // equation / equation* cannot sit inside $$...$$ in MathJax; strip the wrapper, keep \tag.
  // align / align* without an inner \tag -> aligned (an align env inside $$ can error).
  function cleanDisplayTex(tex) {
    return tex
      .replace(/^\s*\\begin\{(equation\*?)\}([\s\S]*)\\end\{\1\}\s*$/, '$2')
      .replace(/\\begin\{(align\*?)\}([\s\S]*?)\\end\{\1\}/g, (m, env, inner) =>
        /\\tag\{/.test(inner) ? m : '\\begin{aligned}' + inner + '\\end{aligned}')
      .trim();
  }

  function mathNode(tex, block) {
    const m = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
    if (block) m.setAttribute('display', 'block');
    m.setAttribute('data-latex', tex);
    const sem = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'semantics');
    const ann = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'annotation');
    ann.setAttribute('encoding', 'application/x-tex');
    ann.textContent = tex; // non-empty child: Turndown drops empty <math> as "blank"
    sem.appendChild(ann);
    m.appendChild(sem);
    return m;
  }

  function convertMath(root) {
    root.querySelectorAll('disp-formula').forEach((f) => {
      const tex = cleanDisplayTex(texOf(f));
      if (tex) f.replaceWith(mathNode(tex, true));
    });
    root.querySelectorAll('inline-formula').forEach((f) => {
      const tex = texOf(f);
      if (tex) f.replaceWith(mathNode(tex, false));
    });
    // Leftover MathJax render nodes (formulas outside the two wrappers)
    root.querySelectorAll('.MathJax_Preview, .MathJax, .MathJax_Display, script').forEach((n) => n.remove());
  }

  // ---------- cleanup of the cloned full text ----------

  function cleanBody(root) {
    convertMath(root);
    // "SECTION I." kicker above each heading, zoom buttons, "View Source" links
    root.querySelectorAll('.kicker, button, .zoom-container > button, .link').forEach((n) => n.remove());
    // In-text citation / equation anchors with no real target: keep the text only
    root.querySelectorAll('a.fulltext-link').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript')) {
        a.replaceWith(document.createTextNode(a.textContent));
      }
    });
    // Absolute image URLs so figures work if you drop remove_html:".figure" from the template
    root.querySelectorAll('img[src]').forEach((img) => {
      const large = img.closest('a') && img.closest('a').getAttribute('href');
      const src = large && /\.(gif|png|jpe?g)$/i.test(large) ? large : img.getAttribute('src');
      img.setAttribute('src', new URL(src, location.origin).href);
      img.removeAttribute('loading');
    });
    root.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    return root;
  }

  function buildBody() {
    const art = document.querySelector('#article');
    if (!art) return;
    const sig = art.querySelectorAll('*').length + ':' + art.textContent.length;
    if (sig === lastBodySig && document.querySelector('.' + OWC + '-body[data-owc-article="' + lastArticle + '"]')) return;
    lastBodySig = sig;
    const clone = cleanBody(art.cloneNode(true));
    const wrap = document.createElement('div');
    while (clone.firstChild) wrap.appendChild(clone.firstChild);
    replaceBlock(OWC + '-body', wrap);
  }

  function buildAbstract() {
    const abs = document.querySelector('.abstract-desktop-div .abstract-text-content');
    if (!abs) return;
    const sig = abs.textContent.length + ':' + abs.querySelectorAll('*').length;
    if (sig === lastAbsSig && document.querySelector('.' + OWC + '-abstract[data-owc-article="' + lastArticle + '"]')) return;
    lastAbsSig = sig;
    const clone = abs.cloneNode(true);
    convertMath(clone);
    const wrap = document.createElement('div');
    wrap.appendChild(clone);
    replaceBlock(OWC + '-abstract', wrap);
  }

  // ---------- keywords ----------

  function buildKeywords() {
    const m = meta();
    if (!m || !Array.isArray(m.keywords)) return;
    document.head.querySelectorAll('meta[data-owc-article]').forEach((n) => n.remove());
    const groups = {
      citation_keywords: ['Author Keywords'],
      owc_ieee_keywords: ['IEEE Keywords'],
    };
    Object.entries(groups).forEach(([name, types]) => {
      const seen = new Set();
      m.keywords
        .filter((g) => types.includes(g.type))
        .forEach((g) => (g.kwd || []).forEach((k) => {
          const v = String(k).trim();
          if (!v || seen.has(v)) return;
          seen.add(v);
          const tag = document.createElement('meta');
          tag.setAttribute('name', name);
          tag.setAttribute('content', v);
          tag.setAttribute('data-owc-article', lastArticle);
          document.head.appendChild(tag);
        }));
    });
  }

  // ---------- references ----------

  async function buildReferences(id) {
    try {
      const r = await fetch('/rest/document/' + id + '/references', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!r.ok) return;
      const j = await r.json();
      if (id !== lastArticle) return; // navigated away meanwhile
      const refs = Array.isArray(j.references) ? j.references : [];
      if (!refs.length) return;
      const ol = document.createElement('ol');
      refs.forEach((ref) => {
        const li = document.createElement('li');
        // ref.text can hold light HTML (<i>, <sub>); parse it inertly and keep text + math
        const tmp = new DOMParser().parseFromString('<div>' + (ref.text || '') + '</div>', 'text/html').body.firstChild;
        convertMath(tmp);
        while (tmp.firstChild) li.appendChild(tmp.firstChild);
        ol.appendChild(li);
      });
      replaceBlock(OWC + '-references', ol);
    } catch (e) {
      console.warn('[owc-ieee] references fetch failed:', e);
    }
  }

  // ---------- main loop ----------

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const id = articleNumber();
      if (!id) return;
      if (id !== lastArticle) {
        lastArticle = id;
        lastBodySig = lastAbsSig = '';
        const box = document.querySelector('div.' + OWC + '-container');
        if (box) box.textContent = '';
        buildKeywords();
        buildReferences(id);
      }
      buildAbstract();
      buildBody();
    } finally {
      busy = false;
    }
  }

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(tick, 800);
  };
  new MutationObserver((muts) => {
    // ignore our own hidden container
    if (muts.every((m) => m.target.closest && m.target.closest('div.' + OWC + '-container'))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  schedule();
})();

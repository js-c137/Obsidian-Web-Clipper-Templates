// ==UserScript==
// @name         arXiv HTML → Obsidian Web Clipper prep
// @namespace    obsidian-web-clipper-templates
// @version      1.0.0
// @description  Adds citation_* metadata (from the /abs page) to arXiv HTML (LaTeXML) papers and builds hidden, clip-ready copies of the body and reference list, for use with arxiv-article.json.
// @match        https://arxiv.org/html/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/*
 * Why this exists
 * ---------------
 * arXiv's HTML view (LaTeXML) has no citation_* meta tags at all, and the author line
 * carries raw TeX macros ("Thomas Edridge\affilnum1 and Manon Kok\affilnum1").
 * Inline maths is fine: every <math> carries <annotation encoding="application/x-tex">,
 * which the Web Clipper |markdown filter converts natively. Display equations are not:
 * LaTeXML splits each aligned row across table cells, so each cell would become its
 * own $$...$$ block, and equation numbers are lost.
 *
 * What it does (the visible page is not modified)
 *   - fetches /abs/<id> (same origin) and injects into <head>:
 *       citation_title, citation_author (one per author, adjacent, "Surname, Given"),
 *       citation_arxiv_id, citation_doi (arXiv DataCite DOI 10.48550/arXiv.<id>),
 *       owc_date (YYYY-MM-DD), owc_version, owc_primary_category, owc_subjects,
 *       owc_comments, owc_journal_ref, owc_journal_doi (if the /abs page lists one)
 *   - citation_keywords from the paper's own keyword line (.ltx_classification)
 *   - .owc-arxiv-body        hidden clone of the numbered sections and appendices:
 *                            one $$...\tag{n}$$ per equation row, in-page links unwrapped,
 *                            footnotes collected into a Footnotes list at the end
 *   - .owc-arxiv-references  hidden <ol> of the bibliography without labels or "Cited by"
 */

(function () {
  'use strict';

  const OWC = 'owc-arxiv';
  const MML = 'http://www.w3.org/1998/Math/MathML';
  let lastKey = null;
  let lastBodySig = '';

  // ---------- helpers ----------

  function paperKey() {
    // /html/2604.19946v1 or /html/2604.19946v1/ or /html/2604.19946
    const m = location.pathname.match(/\/html\/([^/]+?)\/?$/) || location.pathname.match(/\/html\/([^/]+)/);
    return m ? m[1] : null;
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
    if (old) old.replaceWith(node);
    else box.appendChild(node);
  }

  function addMeta(name, content) {
    if (!content) return;
    const m = document.createElement('meta');
    m.setAttribute('name', name);
    m.setAttribute('content', content);
    m.setAttribute('data-owc', '1');
    document.head.appendChild(m);
  }

  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // ---------- metadata from /abs ----------

  async function injectMetadata(key) {
    document.head.querySelectorAll('meta[data-owc]').forEach((n) => n.remove());

    // Keywords: from the paper itself
    const cls = document.querySelector('.ltx_classification');
    if (cls) {
      const c = cls.cloneNode(true);
      c.querySelectorAll('.ltx_title').forEach((t) => t.remove());
      clean(c.textContent).replace(/^keywords:?\s*/i, '').split(/\s*[,;]\s*/)
        .filter(Boolean).forEach((k) => addMeta('citation_keywords', k.replace(/\.$/, '')));
    }

    try {
      const r = await fetch('/abs/' + key, { credentials: 'same-origin' });
      if (!r.ok || key !== lastKey) return;
      const d = new DOMParser().parseFromString(await r.text(), 'text/html');
      const meta = (n) => [...d.querySelectorAll('meta[name="' + n + '"]')].map((m) => clean(m.getAttribute('content')));
      const cell = (c) => { const e = d.querySelector('td.tablecell.' + c); return e ? clean(e.textContent) : ''; };

      addMeta('citation_title', meta('citation_title')[0]);
      meta('citation_author').forEach((a) => addMeta('citation_author', a)); // kept adjacent
      const id = meta('citation_arxiv_id')[0] || key.replace(/v\d+$/, '');
      addMeta('citation_arxiv_id', id);
      addMeta('citation_doi', meta('citation_doi')[0] || '10.48550/arXiv.' + id);
      const date = meta('citation_date')[0] || meta('citation_online_date')[0];
      if (date) addMeta('owc_date', date.replace(/\//g, '-'));
      const v = key.match(/v(\d+)$/);
      addMeta('owc_version', v ? 'v' + v[1] : '');
      const subjects = cell('subjects');
      const primary = d.querySelector('td.tablecell.subjects .primary-subject');
      addMeta('owc_primary_category', primary ? clean(primary.textContent) : subjects.split(';')[0]);
      subjects.split(/\s*;\s*/).filter(Boolean).forEach((s) => addMeta('owc_subjects', s));
      addMeta('owc_comments', cell('comments'));
      addMeta('owc_journal_ref', cell('jref'));
      const jdoi = d.querySelector('td.tablecell.doi a');
      addMeta('owc_journal_doi', jdoi ? clean(jdoi.textContent) : '');
    } catch (e) {
      console.warn('[owc-arxiv] /abs fetch failed:', e);
    }
  }

  // ---------- equations ----------

  function texOf(cell) {
    const ann = cell.querySelector('annotation[encoding="application/x-tex"]');
    if (ann) return ann.textContent;
    const m = cell.querySelector('math[alttext]');
    return m ? m.getAttribute('alttext') : '';
  }

  function mathNode(tex) {
    const m = document.createElementNS(MML, 'math');
    m.setAttribute('display', 'block');
    m.setAttribute('data-latex', tex);
    const sem = document.createElementNS(MML, 'semantics');
    const ann = document.createElementNS(MML, 'annotation');
    ann.setAttribute('encoding', 'application/x-tex');
    ann.textContent = tex; // non-empty child: Turndown drops an empty <math> as "blank"
    sem.appendChild(ann);
    m.appendChild(sem);
    return m;
  }

  // table.ltx_equation / table.ltx_equationgroup -> one $$...\tag{n}$$ per row
  function convertEquationTables(root) {
    root.querySelectorAll('table.ltx_equationgroup, table.ltx_equation').forEach((tbl) => {
      if (!tbl.isConnected && !root.contains(tbl)) return; // already replaced as part of a group
      const frag = document.createElement('div');
      tbl.querySelectorAll('tr').forEach((tr) => {
        const parts = [];
        let tag = '';
        tr.querySelectorAll('td').forEach((td) => {
          if (td.classList.contains('ltx_eqn_eqno')) {
            tag = clean(td.textContent).replace(/^\(|\)$/g, '');
            return;
          }
          const t = texOf(td);
          if (t) parts.push(t.replace(/^\s*\\displaystyle\s*/, '').trim());
        });
        if (!parts.length) return;
        let tex = parts.join(' ');
        if (tag) tex += ' \\tag{' + tag + '}';
        frag.appendChild(mathNode(tex));
      });
      tbl.replaceWith(...frag.childNodes);
    });
  }

  // \bm (LaTeX bm package) is not a MathJax 3 built-in; \boldsymbol is equivalent and is.
  function fixTex(t) {
    return t.replace(/\\bm(?![a-zA-Z])/g, '\\boldsymbol');
  }

  function fixMacros(root) {
    root.querySelectorAll('annotation[encoding="application/x-tex"]').forEach((a) => { a.textContent = fixTex(a.textContent); });
    root.querySelectorAll('math[data-latex]').forEach((m) => m.setAttribute('data-latex', fixTex(m.getAttribute('data-latex'))));
    root.querySelectorAll('math[alttext]').forEach((m) => m.setAttribute('alttext', fixTex(m.getAttribute('alttext'))));
  }

  // ---------- body ----------

  function collectFootnotes(root) {
    const notes = [];
    root.querySelectorAll('.ltx_note.ltx_role_footnote').forEach((n) => {
      const mark = n.querySelector(':scope > .ltx_note_mark');
      const content = n.querySelector('.ltx_note_content');
      const num = mark ? clean(mark.textContent) : String(notes.length + 1);
      if (content) {
        const c = content.cloneNode(true);
        c.querySelectorAll('.ltx_note_mark, .ltx_tag_note').forEach((x) => x.remove());
        notes.push({ num, node: c });
      }
      const sup = document.createElement('sup');
      sup.textContent = num;
      n.replaceWith(sup);
    });
    if (!notes.length) return;
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = 'Footnotes';
    const ol = document.createElement('ol');
    notes.forEach(({ node }) => {
      const li = document.createElement('li');
      while (node.firstChild) li.appendChild(node.firstChild);
      ol.appendChild(li);
    });
    sec.append(h, ol);
    root.appendChild(sec);
  }

  function buildBody() {
    const art = document.querySelector('article.ltx_document');
    if (!art) return;
    const sig = art.querySelectorAll('*').length + ':' + art.textContent.length;
    if (sig === lastBodySig && container().querySelector('.' + OWC + '-body')) return;
    lastBodySig = sig;

    const wrap = document.createElement('div');
    art.querySelectorAll(':scope > section.ltx_section, :scope > section.ltx_appendix, :scope > section.ltx_acknowledgements')
      .forEach((s) => wrap.appendChild(s.cloneNode(true)));

    convertEquationTables(wrap);
    fixMacros(wrap);
    collectFootnotes(wrap);
    // In-page links (citations, equations, sections, figures): keep the text only
    wrap.querySelectorAll('a[href^="#"]').forEach((a) => a.replaceWith(...a.childNodes));
    // Absolute image URLs so figures work if you drop remove_html:"figure.ltx_figure"
    wrap.querySelectorAll('img[src]').forEach((img) => img.setAttribute('src', new URL(img.getAttribute('src'), location.href).href));
    wrap.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    replaceBlock(OWC + '-body', wrap);
  }

  // ---------- references ----------

  function buildReferences() {
    if (container().querySelector('.' + OWC + '-references')) return;
    const items = document.querySelectorAll('.ltx_bibliography li.ltx_bibitem');
    if (!items.length) return;
    const ol = document.createElement('ol');
    items.forEach((it) => {
      const li = document.createElement('li');
      it.querySelectorAll(':scope > .ltx_bibblock:not(.ltx_bib_cited)').forEach((b, i) => {
        if (i) li.appendChild(document.createTextNode(' '));
        const c = b.cloneNode(true);
        c.querySelectorAll('a[href^="#"]').forEach((a) => a.replaceWith(...a.childNodes));
        while (c.firstChild) li.appendChild(c.firstChild);
      });
      ol.appendChild(li);
    });
    replaceBlock(OWC + '-references', ol);
  }

  // ---------- main loop ----------

  function tick() {
    const key = paperKey();
    if (!key) return;
    if (key !== lastKey) {
      lastKey = key;
      lastBodySig = '';
      const box = document.querySelector('div.' + OWC + '-container');
      if (box) box.textContent = '';
      injectMetadata(key);
    }
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

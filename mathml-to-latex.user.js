// ==UserScript==
// @name         MathML → LaTeX for Obsidian Web Clipper
// @namespace    https://github.com/js-c137/obsidian-web-clipper-templates
// @version      1.0.0
// @description  Converts MathML equations to $...$ / $$...$$ in the DOM before Obsidian Web Clipper clips the page
// @author       js-c137
// @match        *://*.sciencedirect.com/*
// @match        *://agupubs.onlinelibrary.wiley.com/*
// @match        *://onlinelibrary.wiley.com/*
// @match        *://link.springer.com/*
// @match        *://www.springer.com/*
// @match        *://www.science.org/*
// @match        *://science.org/*
// @match        *://pubs.geoscienceworld.org/*
// @match        *://academic.oup.com/*
// @match        *://www.mdpi.com/*
// @match        *://www.tandfonline.com/*
// @run-at       document-idle
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/mathml-to-latex@1.3.3/dist/index.min.js
// ==/UserScript==

(async function () {
  'use strict';

  // --- Symbol tables for the built-in fallback converter ---

  const MI_MAP = {
    'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ε':'\\epsilon',
    'ζ':'\\zeta','η':'\\eta','θ':'\\theta','ι':'\\iota','κ':'\\kappa',
    'λ':'\\lambda','μ':'\\mu','ν':'\\nu','ξ':'\\xi','π':'\\pi',
    'ρ':'\\rho','σ':'\\sigma','τ':'\\tau','υ':'\\upsilon','φ':'\\phi',
    'χ':'\\chi','ψ':'\\psi','ω':'\\omega',
    'Γ':'\\Gamma','Δ':'\\Delta','Θ':'\\Theta','Λ':'\\Lambda','Ξ':'\\Xi',
    'Π':'\\Pi','Σ':'\\Sigma','Υ':'\\Upsilon','Φ':'\\Phi','Ψ':'\\Psi','Ω':'\\Omega',
    'ℝ':'\\mathbb{R}','ℕ':'\\mathbb{N}','ℤ':'\\mathbb{Z}','ℚ':'\\mathbb{Q}','ℂ':'\\mathbb{C}',
  };

  const MO_MAP = {
    '+':'+','−':'-','-':'-','×':'\\times','·':'\\cdot','÷':'\\div',
    '=':'=','≠':'\\neq','<':'<','>':'>',
    '≤':'\\leq','≥':'\\geq','≪':'\\ll','≫':'\\gg',
    '≈':'\\approx','∼':'\\sim','≃':'\\simeq','≡':'\\equiv','∝':'\\propto',
    '∈':'\\in','∉':'\\notin','⊂':'\\subset','⊃':'\\supset','⊆':'\\subseteq','⊇':'\\supseteq',
    '∪':'\\cup','∩':'\\cap',
    '∑':'\\sum','∏':'\\prod','∫':'\\int','∬':'\\iint','∭':'\\iiint',
    '∮':'\\oint','∂':'\\partial','∇':'\\nabla',
    '∞':'\\infty','±':'\\pm','∓':'\\mp',
    '→':'\\to','←':'\\leftarrow','↔':'\\leftrightarrow',
    '⇒':'\\Rightarrow','⇐':'\\Leftarrow','⇔':'\\Leftrightarrow',
    '↑':'\\uparrow','↓':'\\downarrow',
    '∀':'\\forall','∃':'\\exists',
    '⊗':'\\otimes','⊕':'\\oplus','⊙':'\\odot',
    '(':'(',')':', )','[':'[',']':']','{':'\\{','}':'\\}',
    '|':'|','‖':'\\|',
    ',':',','.':'.',';':';',':':':',
    "′":"'","″":"''","‴":"'''",
  };

  const ACCENT_MAP = {
    '→':'\\vec','⃗':'\\vec',
    '˙':'\\dot','̇':'\\dot',
    '¨':'\\ddot','̈':'\\ddot',
    '^':'\\hat','̂':'\\hat',
    '~':'\\tilde','̃':'\\tilde',
    '‾':'\\bar','̄':'\\bar',
    '˘':'\\breve',
  };

  // --- Built-in recursive MathML → LaTeX converter (fallback) ---

  function walk(node) {
    if (!node) return '';
    if (node.nodeType === 3) return node.textContent;

    const tag = (node.tagName || '').toLowerCase().replace(/^[a-z]+:/, '');
    const kids = () => Array.from(node.childNodes).map(walk).join('');
    const k = (i) => walk(node.childNodes[i] || null);

    switch (tag) {
      case 'math':      return kids();
      case 'semantics': return k(0); // first child is the actual math; annotations follow
      case 'annotation': case 'annotation-xml': return '';

      case 'mrow': case 'mstyle': case 'mpadded':
      case 'merror': case 'maction': return kids();

      case 'mi': {
        const t = node.textContent;
        if (MI_MAP[t]) return MI_MAP[t];
        // Multi-char identifiers are upright; single-char are italic by convention
        const variant = node.getAttribute('mathvariant');
        if (variant === 'normal' || t.length > 1) return `\\mathrm{${t}}`;
        return t;
      }

      case 'mn': return node.textContent;

      case 'mo': {
        const t = node.textContent.trim();
        return MO_MAP[t] !== undefined ? MO_MAP[t] : t;
      }

      case 'mtext': return `\\text{${node.textContent}}`;
      case 'ms':    return `\\texttt{${node.textContent}}`;

      case 'msup':    return `{${k(0)}}^{${k(1)}}`;
      case 'msub':    return `{${k(0)}}_{${k(1)}}`;
      case 'msubsup': return `{${k(0)}}_{${k(1)}}^{${k(2)}}`;

      case 'mover': {
        const base = k(0);
        const overText = (node.childNodes[1] || {textContent:''}).textContent.trim();
        const cmd = ACCENT_MAP[overText];
        return cmd ? `${cmd}{${base}}` : `\\overset{${k(1)}}{${base}}`;
      }
      case 'munder': {
        const base = k(0);
        const underText = (node.childNodes[1] || {textContent:''}).textContent.trim();
        if (underText === '⏟') return `\\underbrace{${base}}`;
        return `\\underset{${k(1)}}{${base}}`;
      }
      case 'munderover': return `{${k(0)}}_{${k(1)}}^{${k(2)}}`;

      case 'mfrac': {
        if (node.getAttribute('bevelled') === 'true') return `${k(0)}/${k(1)}`;
        return `\\frac{${k(0)}}{${k(1)}}`;
      }

      case 'msqrt': return `\\sqrt{${kids()}}`;
      case 'mroot': return `\\sqrt[${k(1)}]{${k(0)}}`;

      case 'mspace': return '\\;';
      case 'mphantom': return `\\phantom{${kids()}}`;
      case 'mfenced': {
        const open  = node.getAttribute('open')  ?? '(';
        const close = node.getAttribute('close') ?? ')';
        const sep   = node.getAttribute('separators') ?? ',';
        const inner = Array.from(node.childNodes).map(walk).join(sep ? `${sep}` : ' ');
        return `\\left${open}${inner}\\right${close}`;
      }
      case 'menclose': {
        const n = node.getAttribute('notation') || '';
        if (n.includes('box')) return `\\boxed{${kids()}}`;
        return kids();
      }

      case 'mtable': {
        const rows = Array.from(node.querySelectorAll('mtr')).map(tr =>
          Array.from(tr.querySelectorAll('mtd')).map(walk).join(' & ')
        ).join(' \\\\\n');
        return `\\begin{pmatrix}\n${rows}\n\\end{pmatrix}`;
      }
      case 'mtr': case 'mtd': return kids();

      default: return kids();
    }
  }

  // --- Resolve the @require'd library (CommonJS export shape varies) ---

  function resolveLib() {
    if (typeof MathMLToLaTeX !== 'undefined') return MathMLToLaTeX;
    if (typeof module !== 'undefined' && module.exports) {
      const ex = module.exports;
      return ex.MathMLToLaTeX || ex.default || (typeof ex === 'function' ? ex : null);
    }
    return null;
  }

  // --- Convert a MathML string to a LaTeX string ---

  const lib = resolveLib();

  function mathmlStringToLatex(mathHtml) {
    // Priority 1: LaTeX annotation embedded by MathJax (lossless if present)
    const tmp = document.createElement('div');
    tmp.innerHTML = mathHtml;
    const ann = tmp.querySelector('annotation[encoding="application/x-tex"]');
    if (ann && ann.textContent.trim()) return ann.textContent.trim();

    // Priority 2: mathml-to-latex library loaded via @require
    if (lib) {
      try {
        return typeof lib.convert === 'function' ? lib.convert(mathHtml) : lib(mathHtml);
      } catch (e) {
        console.warn('[MathML→LaTeX] CDN library failed:', e);
      }
    }

    // Priority 3: built-in recursive converter
    return walk(tmp.querySelector('math') || tmp.firstChild || tmp);
  }

  // --- Replace a math DOM element with a LaTeX text node/wrapper ---

  function replaceMathEl(el) {
    const isDisplay = el.getAttribute('display') === 'block';
    const latex = mathmlStringToLatex(el.outerHTML);
    if (!latex) return;

    // Walk up to replace the mjx-container if MathJax has already rendered it
    const target = el.closest('mjx-container, .MathJax_Display') || el;

    if (isDisplay) {
      const p = document.createElement('p');
      p.textContent = `$$\n${latex}\n$$`;
      target.parentNode.replaceChild(p, target);
    } else {
      const span = document.createElement('span');
      span.textContent = `$${latex}$`;
      target.parentNode.replaceChild(span, target);
    }
  }

  // --- Wait for MathJax to finish before scanning ---

  if (window.MathJax && MathJax.startup) {
    try { await MathJax.startup.promise; } catch (_) {}
  }

  // --- Strategy A: MathJax 3 API — recovers the original source math ---
  // This is the most accurate path because MathJax stores the exact source string.

  if (window.MathJax && MathJax.startup && MathJax.startup.document) {
    try {
      const items = MathJax.startup.document.getMathItemsWithin(document.body);
      for (const item of items) {
        const source   = item.math;
        const jaxName  = item.inputJax && item.inputJax.name; // 'TeX' | 'MathML' | 'AsciiMath'
        const isDisplay = item.display;
        const root     = item.typesetRoot; // <mjx-container>

        if (!root || !root.parentNode || !source) continue;

        let latex;
        if (jaxName === 'TeX') {
          latex = source; // already LaTeX — use verbatim
        } else {
          latex = mathmlStringToLatex(source);
        }
        if (!latex) continue;

        if (isDisplay) {
          const p = document.createElement('p');
          p.textContent = `$$\n${latex}\n$$`;
          root.parentNode.replaceChild(p, root);
        } else {
          const span = document.createElement('span');
          span.textContent = `$${latex}$`;
          root.parentNode.replaceChild(span, root);
        }
      }
      console.log('[MathML→LaTeX] Converted via MathJax API');
      return;
    } catch (e) {
      console.warn('[MathML→LaTeX] MathJax API failed, falling back to DOM scan:', e);
    }
  }

  // --- Strategy B: Bare <math> elements (no MathJax, or MathJax API unavailable) ---

  const mathEls = Array.from(document.querySelectorAll('math'));
  if (mathEls.length === 0) return;

  // Process in reverse DOM order so replacements don't shift siblings
  mathEls.reverse().forEach(replaceMathEl);
  console.log(`[MathML→LaTeX] Converted ${mathEls.length} equation(s) via DOM scan`);

})();

#!/usr/bin/env python3
"""
fix_math.py — Post-process Obsidian clipped notes:
  1. Convert raw MathML to LaTeX (requires pandoc on PATH)
  2. Convert double- or single-encoded MathML to LaTeX (ScienceDirect pattern)
  3. Clean up Taylor & Francis in-text citation formatting

Usage:
  python fix_math.py <vault_root>        scan Research/Literature/ for .md files
  python fix_math.py <file.md>           process a single file
  python fix_math.py <dir/>              scan a specific directory recursively
  python fix_math.py --dry-run <target>  preview changes without writing
"""

import html as html_module
import re
import sys
import subprocess
import shutil
from pathlib import Path

# Raw MathML
MATH_RE = re.compile(r'<math\b[^>]*>.*?</math>', re.DOTALL | re.IGNORECASE)

# Double-encoded MathML — ScienceDirect clips equations as:
#   UNICODE_PLAINTEXT&amp;lt;math...&amp;lt;/math&amp;gt;
# inside $$ ... $$ blocks. The plaintext prefix is the pre-rendered Unicode
# representation of the same math; it must be discarded.
# Prefix is bounded to stay within a single line / table cell (no $, \n, |).
DBLENC_MATH_RE = re.compile(
    r'[^$\n|]*?&amp;lt;math\b.*?&amp;lt;/math&amp;gt;',
    re.DOTALL | re.IGNORECASE,
)

# Single-encoded MathML — same pattern but HTML-escaped once:
#   UNICODE_PLAINTEXT&lt;math...&lt;/math&gt;
SINGENC_MATH_RE = re.compile(
    r'[^$\n|]*?&lt;math\b.*?&lt;/math&gt;',
    re.DOTALL | re.IGNORECASE,
)

# T&F in-text citations — strips "Citation" prefix, keeps everything after it:
#   [Citation1991](#)              → 1991
#   [Citation2017a](#)             → 2017a
#   [Citation2020;](#)             → 2020;
#   [CitationAnderson et al., 2017](#) → Anderson et al., 2017
TANDF_CITE_RE = re.compile(r'\[Citation([^\]]*)\]\([^)]*\)')
# T&F bold-wrapped parentheses from <b>(</b> and <b>)</b> in source HTML:
#   **(**  ***)**  ***)***  etc. → plain ( or )
TANDF_BOLD_OPEN_RE  = re.compile(r'\*{1,3}\(\*{1,3}')
TANDF_BOLD_CLOSE_RE = re.compile(r'\*{1,3}\)\*{1,3}')


def pandoc_convert(mathml: str) -> str:
    result = subprocess.run(
        ['pandoc', '-f', 'html', '-t', 'markdown+tex_math_dollars', '--wrap=none'],
        input=mathml, capture_output=True, text=True, encoding='utf-8', timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def _strip_math_delims(s: str) -> str:
    """Remove outer $...$ or $$...$$ delimiters that pandoc adds.
    Used when the MathML is already inside an Obsidian $$...$$ block."""
    s = s.strip()
    if s.startswith('$$') and s.endswith('$$'):
        return s[2:-2].strip()
    if s.startswith('$') and s.endswith('$'):
        return s[1:-1].strip()
    return s


def process_file(path: Path, dry_run: bool = False) -> tuple[int, int]:
    """
    Fix MathML and T&F citations in one pass.
    Returns (equations_converted, citations_cleaned).
    """
    content = path.read_text(encoding='utf-8')
    new_content = content

    math_count = 0
    errors = []

    # --- Raw MathML → LaTeX ---
    if '<math' in content.lower():
        def replace(m: re.Match) -> str:
            nonlocal math_count
            try:
                latex = pandoc_convert(m.group(0))
                if latex:
                    math_count += 1
                    return latex
            except Exception as e:
                errors.append(str(e))
            return m.group(0)
        new_content = MATH_RE.sub(replace, new_content)

    # --- Double-encoded MathML → LaTeX (&amp;lt;math...&amp;lt;/math&amp;gt;) ---
    # These always appear inside existing $$...$$ blocks, so strip pandoc's
    # outer $...$ delimiters — the block already provides them.
    if '&amp;lt;math' in new_content:
        def replace_dbl(m: re.Match) -> str:
            nonlocal math_count
            full = m.group(0)
            idx = full.index('&amp;lt;math')
            decoded = html_module.unescape(html_module.unescape(full[idx:]))
            try:
                latex = _strip_math_delims(pandoc_convert(decoded))
                if latex:
                    math_count += 1
                    return latex
            except Exception as e:
                errors.append(str(e))
            return full
        new_content = DBLENC_MATH_RE.sub(replace_dbl, new_content)

    # --- Single-encoded MathML → LaTeX (&lt;math...&lt;/math&gt;) ---
    if '&lt;math' in new_content:
        def replace_sng(m: re.Match) -> str:
            nonlocal math_count
            full = m.group(0)
            idx = full.index('&lt;math')
            decoded = html_module.unescape(full[idx:])
            try:
                latex = _strip_math_delims(pandoc_convert(decoded))
                if latex:
                    math_count += 1
                    return latex
            except Exception as e:
                errors.append(str(e))
            return full
        new_content = SINGENC_MATH_RE.sub(replace_sng, new_content)

    for e in errors:
        print(f'  [warn] {path.name}: {e}')

    # --- T&F citation cleanup ---
    cite_count = len(TANDF_CITE_RE.findall(new_content))
    if cite_count:
        new_content = TANDF_CITE_RE.sub(r'\1', new_content)
        new_content = TANDF_BOLD_OPEN_RE.sub('(', new_content)
        new_content = TANDF_BOLD_CLOSE_RE.sub(')', new_content)

    if new_content == content:
        return 0, 0

    if dry_run:
        if math_count:
            print(f'  [dry-run] {path.name}: {math_count} equation(s) would be converted')
        if cite_count:
            print(f'  [dry-run] {path.name}: {cite_count} citation(s) would be cleaned')
    else:
        path.write_text(new_content, encoding='utf-8')
        if math_count:
            print(f'  {path.name}: {math_count} equation(s) converted')
        if cite_count:
            print(f'  {path.name}: {cite_count} citation(s) cleaned')

    return math_count, cite_count


def collect_files(target: Path) -> list[Path]:
    if target.is_file():
        return [target]
    lit = target / 'Research' / 'Literature'
    search_root = lit if lit.is_dir() else target
    return sorted(search_root.rglob('*.md'))


def main() -> None:
    args = sys.argv[1:]
    dry_run = '--dry-run' in args
    args = [a for a in args if a != '--dry-run']

    if not args:
        print(__doc__)
        sys.exit(1)

    target = Path(args[0])
    if not target.exists():
        print(f'Error: {target} does not exist')
        sys.exit(1)

    files = collect_files(target)
    if not files:
        print('No .md files found.')
        return

    # Only require pandoc if any file contains MathML (raw or HTML-encoded)
    needs_pandoc = any(
        '<math' in t or '&amp;lt;math' in t or '&lt;math' in t
        for f in files
        for t in [f.read_text(encoding='utf-8', errors='ignore').lower()]
    )
    if needs_pandoc and not shutil.which('pandoc'):
        print('Error: pandoc not found on PATH (required for MathML conversion).')
        print('Install from https://pandoc.org/installing.html')
        sys.exit(1)

    total_files = total_eqs = total_cites = 0
    for f in files:
        eqs, cites = process_file(f, dry_run=dry_run)
        if eqs or cites:
            total_files += 1
            total_eqs += eqs
            total_cites += cites

    action = 'would be updated' if dry_run else 'updated'
    parts = []
    if total_eqs:
        parts.append(f'{total_eqs} equation(s) converted')
    if total_cites:
        parts.append(f'{total_cites} citation(s) cleaned')
    summary = ', '.join(parts) or 'nothing to fix'
    print(f'\nDone. {total_files} file(s) {action} — {summary}.')


if __name__ == '__main__':
    main()

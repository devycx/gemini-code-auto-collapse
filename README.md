# Gemini Code Block Auto-Collapse

When Gemini answers with 200–300 lines of code, you have to scroll several screens before you reach the explanation. This userscript folds long code blocks into a single header row; click to expand.

**English** | [简体中文](README.zh-CN.md)

- Install: [Greasy Fork](https://greasyfork.org/en/scripts/605151)
- Source: [GitHub](https://github.com/devycx/gemini-code-auto-collapse) · [direct .user.js](https://raw.githubusercontent.com/devycx/gemini-code-auto-collapse/main/gemini-code-auto-collapse.user.js)
- Works on: `https://gemini.google.com/*`
- Version: 2.2.0

## What it does

1. **Auto-collapse long code**: blocks with 5 or more lines start collapsed; shorter blocks are left alone.
2. **Status and line count in the header**: `▶ Click to expand code (42 lines | Alt+C toggles all)` when collapsed, `▼ Click here or the code area to collapse` when expanded.
3. **Two ways to collapse**: click the header to expand; click anywhere in the expanded code to collapse it again.
4. **No accidental toggles**: a pointer movement of more than 8px, or selected text on the page, cancels the click.
5. **Alt+C toggles everything**: if any block is expanded, all collapse; otherwise all expand, with a toast showing the count.
6. **Header color follows the code**: the header uses the `code` element's computed color, so it stays readable on dark and light themes.

## Configuration

Edit the two constants at the top of the script and refresh the page:

| Setting | Default | Meaning |
| --- | --- | --- |
| `AUTO_COLLAPSE_THRESHOLD` | `5` | Minimum line count for auto-collapse; `0` collapses every block, including short ones |
| `SHORTCUT_KEY_CODE` | `'KeyC'` | Global toggle key; change to `'KeyZ'` for Alt+Z |

## Implementation notes

- **Three-state marker**: each block stores `pending` / `collapsed` / `manual` in `data-tm-auto-state`. Gemini streams output, so a block may appear with two lines and grow past the threshold later; a block the user touched manually is never re-collapsed by a later scan.
- **MutationObserver + requestAnimationFrame**: DOM changes only set a flag; scanning is merged into the next frame and runs at most once per frame.
- **Ignore our own changes**: the header bar and toast are DOM nodes too, so the observer explicitly skips them and avoids an "insert bar → scan → insert bar" loop.
- **Write text only when it changes**: the header line count grows during streaming, so the script stores the last label in `dataset.lastText` and leaves the DOM alone when it is unchanged.
- **800 ms delayed start**: wait for Gemini's first screen (sidebar, model picker) to mount; if the page is already loaded, start after a delay anyway.
- **Collapse without destroying nodes**: `max-height: 0 + overflow: hidden + pointer-events: none` keeps the code block in the DOM, so the page scroll position does not jump.

## Known limits

- Only matches `gemini.google.com`; Gemini embedded in other Google products is not covered.
- Line count is based on newlines in `textContent`. Minified code on a single line is not collapsed — it only occupies one line anyway.
- Depends on Gemini's current `<pre>` structure and the `message-content` / `code-block` containers. A Google redesign may require selector updates.
- `Alt+C` is a window-level listener. If a page already uses that combination, the script runs after the capture phase and behavior may differ.

## License

MIT, see [LICENSE](LICENSE).

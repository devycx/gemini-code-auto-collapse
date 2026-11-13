// ==UserScript==
// @name         Gemini Code Block Auto-Collapse - Fold Long Code Blocks
// @name:en      Gemini Code Block Auto-Collapse - Fold Long Code Blocks
// @name:zh-CN   Gemini 代码块自动折叠
// @namespace    https://github.com/devycx/gemini-code-auto-collapse
// @version      2.2.0
// @description  Automatically collapse long code blocks in Gemini responses into a single header row. Click to expand, click the code to collapse again, and press Alt+C to toggle every block on the page.
// @description:en  Automatically collapse long code blocks in Gemini responses into a single header row. Click to expand, click the code to collapse again, and press Alt+C to toggle every block on the page.
// @description:zh-CN  把 Gemini 回答里的长代码块默认折起来：超过 5 行自动收起，点折叠条展开、点代码区收起，Alt+C 一键切换全部
// @author       ycx
// @license      MIT
// @homepageURL  https://github.com/devycx/gemini-code-auto-collapse
// @supportURL   https://github.com/devycx/gemini-code-auto-collapse/issues
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ================= Configuration =================
    // Collapse code blocks with at least this many lines (0 = collapse every block)
    const AUTO_COLLAPSE_THRESHOLD = 5;
    // Global toggle shortcut: Alt + C by default (change KeyC to KeyZ for Alt + Z)
    const SHORTCUT_KEY_CODE = 'KeyC';
    // =================================================

    const MESSAGES = {
        en: {
            expand: 'Click to expand code',
            collapse: 'Click here or the code area to collapse',
            shortcut: ' | Alt+C toggles all',
            label: (icon, action, lines, shortcutHint) =>
                `${icon} ${action} (${lines} line${lines === 1 ? '' : 's'}${shortcutHint})`,
            noBlocks: 'No code blocks on this page',
            collapsedAll: (count) => `Collapsed all ${count} code block${count === 1 ? '' : 's'}`,
            expandedAll: (count) => `Expanded all ${count} code block${count === 1 ? '' : 's'}`,
        },
        'zh-CN': {
            expand: '点击展开代码',
            collapse: '点击此处或代码区收起',
            shortcut: ' | Alt+C 全局切换',
            label: (icon, action, lines, shortcutHint) => `${icon} ${action}（共 ${lines} 行${shortcutHint}）`,
            noBlocks: '当前页面暂无代码块',
            collapsedAll: (count) => `已全部折叠 (${count} 个代码块)`,
            expandedAll: (count) => `已全部展开 (${count} 个代码块)`,
        },
    };

    function detectLocale() {
        const languages = Array.isArray(navigator.languages) && navigator.languages.length
            ? navigator.languages
            : [navigator.language || 'en'];
        for (const language of languages) {
            const normalized = String(language).toLowerCase();
            if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
            if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
        }
        return 'en';
    }

    const UI_LOCALE = detectLocale();
    const t = MESSAGES[UI_LOCALE] || MESSAGES.en;

    const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    function injectStyles() {
        GM_addStyle(`
            .tm-collapse-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 14px;
                background: rgba(128, 134, 139, 0.16);
                border-bottom: 1px solid rgba(128, 134, 139, 0.22);
                cursor: pointer;
                user-select: none;
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent !important;
                outline: none !important;
                font-size: 12.5px;
                line-height: 1.4;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace, sans-serif;
                color: #e3e3e3;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            @media (hover: hover) and (pointer: fine) {
                .tm-collapse-bar {
                    transition: background 0.15s ease;
                }
                .tm-collapse-bar:hover {
                    background: rgba(128, 134, 139, 0.26);
                }
            }
            .tm-code-collapsible,
            .tm-code-collapsible * {
                -webkit-tap-highlight-color: transparent !important;
                outline: none !important;
            }
            .tm-code-hidden {
                max-height: 0 !important;
                overflow: hidden !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
                margin-top: 0 !important;
                margin-bottom: 0 !important;
                border: none !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            .tm-toast-tip {
                position: fixed;
                top: 20px;
                right: 24px;
                z-index: 99999;
                padding: 8px 16px;
                border-radius: 8px;
                background: rgba(32, 33, 36, 0.92);
                color: #e8eaed;
                font-size: 13px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
                pointer-events: none;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .tm-toast-tip.tm-toast-show {
                opacity: 1;
                transform: translateY(0);
            }
        `);
    }

    function getLineCount(preEl) {
        const text = preEl.textContent || '';
        return text ? text.split('\n').length : 0;
    }

    // Match the code block's own text color so inherited dark text is readable on light pages
    function syncBarTextColor(bar, preEl) {
        const codeEl = preEl.querySelector('code') || preEl;
        const computedColor = window.getComputedStyle(codeEl).color;
        if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
            bar.style.color = computedColor;
        }
    }

    // Write to the DOM only when the text actually changes, preventing a MutationObserver loop
    function updateBarLabel(bar, preEl, isCollapsed) {
        const lines = getLineCount(preEl);
        const icon = isCollapsed ? '▶' : '▼';
        const action = isCollapsed ? t.expand : t.collapse;
        const shortcutHint = isCoarsePointer ? '' : t.shortcut;
        const newText = t.label(icon, action, lines, shortcutHint);

        if (bar.dataset.lastText !== newText) {
            bar.dataset.lastText = newText;
            bar.textContent = newText;
        }
        syncBarTextColor(bar, preEl);
    }

    function toggleSingleCodeBlock(preEl, bar, forceCollapse = null) {
        preEl.dataset.tmAutoState = 'manual';
        const isNowCollapsed = forceCollapse !== null
            ? forceCollapse
            : !preEl.classList.contains('tm-code-hidden');

        preEl.classList.toggle('tm-code-hidden', isNowCollapsed);
        updateBarLabel(bar, preEl, isNowCollapsed);

        // If a very long block was collapsed and its bar is above the viewport, scroll it back into view
        if (isNowCollapsed) {
            const rect = bar.getBoundingClientRect();
            if (rect.top < 60) {
                bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function processCodeBlock(preEl) {
        // Only handle code blocks inside chat messages; leave other page components alone
        if (!preEl.closest('message-content, code-block, .model-response-text, main')) {
            return;
        }

        if (preEl.dataset.tmProcessed) {
            const bar = preEl.previousElementSibling;
            if (bar && bar.classList.contains('tm-collapse-bar')) {
                const lines = getLineCount(preEl);
                if (preEl.dataset.tmAutoState === 'pending' && lines >= AUTO_COLLAPSE_THRESHOLD) {
                    preEl.classList.add('tm-code-hidden');
                    preEl.dataset.tmAutoState = 'collapsed';
                }
                const isCollapsed = preEl.classList.contains('tm-code-hidden');
                updateBarLabel(bar, preEl, isCollapsed);
            }
            return;
        }

        preEl.dataset.tmProcessed = 'true';
        preEl.classList.add('tm-code-collapsible');

        const lines = getLineCount(preEl);
        const shouldCollapse = lines >= AUTO_COLLAPSE_THRESHOLD;

        const bar = document.createElement('div');
        bar.className = 'tm-collapse-bar';

        if (shouldCollapse) {
            preEl.classList.add('tm-code-hidden');
            preEl.dataset.tmAutoState = 'collapsed';
        } else {
            preEl.dataset.tmAutoState = 'pending';
        }

        preEl.parentNode.insertBefore(bar, preEl);
        updateBarLabel(bar, preEl, shouldCollapse);

        // 1. Toggle from the header bar
        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSingleCodeBlock(preEl, bar);
        });

        // 2. Click an expanded code area to collapse it (guard against touch scrolling and text selection)
        let downX = 0;
        let downY = 0;

        preEl.addEventListener('pointerdown', (e) => {
            downX = e.clientX;
            downY = e.clientY;
        }, { passive: true });

        preEl.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length > 0) {
                downX = e.touches[0].clientX;
                downY = e.touches[0].clientY;
            }
        }, { passive: true });

        preEl.addEventListener('click', (e) => {
            if (e.button !== 0) return;
            // Do not collapse if the pointer moved noticeably (scrolling the code or dragging a selection)
            const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
            if (moveDist > 8) return;
            // Do not collapse while text is selected on the page
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            if (!preEl.classList.contains('tm-code-hidden')) {
                e.stopPropagation();
                toggleSingleCodeBlock(preEl, bar, true);
            }
        });
    }

    // Lightweight toast in the top-right corner
    let toastEl = null;
    let toastTimer = null;
    function showToast(msg) {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'tm-toast-tip';
            document.body.appendChild(toastEl);
        }
        toastEl.textContent = msg;
        toastEl.classList.add('tm-toast-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastEl.classList.remove('tm-toast-show');
        }, 1600);
    }

    // 3. Global shortcut: expand or collapse every code block at once
    function toggleAllCodeBlocks() {
        const blocks = Array.from(document.querySelectorAll('pre[data-tm-processed="true"]'));
        if (blocks.length === 0) {
            showToast(t.noBlocks);
            return;
        }

        // If any block is expanded, collapse all; otherwise expand all
        const hasExpanded = blocks.some(pre => !pre.classList.contains('tm-code-hidden'));
        const targetCollapse = hasExpanded;

        blocks.forEach(preEl => {
            const bar = preEl.previousElementSibling;
            if (bar && bar.classList.contains('tm-collapse-bar')) {
                preEl.dataset.tmAutoState = 'manual';
                preEl.classList.toggle('tm-code-hidden', targetCollapse);
                updateBarLabel(bar, preEl, targetCollapse);
            }
        });

        showToast(targetCollapse ? t.collapsedAll(blocks.length) : t.expandedAll(blocks.length));
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === SHORTCUT_KEY_CODE) {
            e.preventDefault();
            toggleAllCodeBlocks();
        }
    });

    // Delay startup to avoid Gemini's first-screen hydration phase (sidebar, model picker)
    function initObserver() {
        injectStyles();
        document.querySelectorAll('pre').forEach(processCodeBlock);

        let rafId = null;
        const observer = new MutationObserver((mutations) => {
            // Ignore DOM changes caused by our own bar and toast to reduce observer work
            const hasRelevantMutation = mutations.some(m => {
                const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
                if (!target) return false;
                if (target.classList.contains('tm-collapse-bar') || target.classList.contains('tm-toast-tip')) {
                    return false;
                }
                return true;
            });

            if (!hasRelevantMutation || rafId) return;

            rafId = requestAnimationFrame(() => {
                document.querySelectorAll('pre').forEach(processCodeBlock);
                rafId = null;
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // Wait for the first-screen UI to mount before taking over
    if (document.readyState === 'complete') {
        setTimeout(initObserver, 800);
    } else {
        window.addEventListener('load', () => setTimeout(initObserver, 800), { once: true });
    }
})();
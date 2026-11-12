// ==UserScript==
// @name         Gemini 代码块自动折叠 (Auto Collapse Code)
// @namespace    https://github.com/devycx
// @version      2.1.1
// @description  自动折叠 Gemini 生成的代码块，支持点击代码区折叠与 Alt+C 全局切换，零阻塞渲染，适配移动端无闪烁
// @author       devycx
// @license      MIT
// @match        https://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @homepageURL  https://github.com/devycx/gemini-code-auto-collapse
// @supportURL   https://github.com/devycx/gemini-code-auto-collapse/issues
// ==/UserScript==

(function () {
    'use strict';

    // ================= 配置项 =================
    // 代码达到多少行时触发自动折叠（设为 0 则所有代码块一律默认折叠）
    const AUTO_COLLAPSE_THRESHOLD = 5;
    // 全局展开/折叠快捷键：默认 Alt + C（修改 KeyC 可更换字母，如 KeyZ 代表 Alt + Z）
    const SHORTCUT_KEY_CODE = 'KeyC';
    // ==========================================

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

    // 同步代码块本身的文字颜色，避免浅色网页+深色代码块下 inherit 到深色字体导致看不清
    function syncBarTextColor(bar, preEl) {
        const codeEl = preEl.querySelector('code') || preEl;
        const computedColor = window.getComputedStyle(codeEl).color;
        if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
            bar.style.color = computedColor;
        }
    }

    // 仅在文本真正发生变化时才写入 DOM，阻断 MutationObserver 死循环
    function updateBarLabel(bar, preEl, isCollapsed) {
        const lines = getLineCount(preEl);
        const icon = isCollapsed ? '▶' : '▼';
        const action = isCollapsed ? '点击展开代码' : '点击此处或代码区收起';
        const shortcutHint = isCoarsePointer ? '' : ' | Alt+C 全局切换';
        const newText = `${icon} ${action}（共 ${lines} 行${shortcutHint}）`;

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

        // 如果折叠了超长代码块且折叠条已滚出屏幕上方，自动平滑对齐视口
        if (isNowCollapsed) {
            const rect = bar.getBoundingClientRect();
            if (rect.top < 60) {
                bar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    function processCodeBlock(preEl) {
        // 仅处理对话消息区域内的代码块，避免误伤页面其他组件
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

        // 1. 点击顶部折叠条切换
        bar.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSingleCodeBlock(preEl, bar);
        });

        // 2. 点击展开的代码区域直接折叠（兼容移动端触摸滑动与桌面端划词防误触）
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
            // 如果手指或鼠标发生明显移动（如上下/左右滑动代码或拖拽选词），不折叠
            const moveDist = Math.hypot(e.clientX - downX, e.clientY - downY);
            if (moveDist > 8) return;
            // 如果当前页面存在选中的高亮文本，不折叠
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            if (!preEl.classList.contains('tm-code-hidden')) {
                e.stopPropagation();
                toggleSingleCodeBlock(preEl, bar, true);
            }
        });
    }

    // 右上角轻量提示框
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

    // 3. 全局快捷键：一键展开或收起全部代码
    function toggleAllCodeBlocks() {
        const blocks = Array.from(document.querySelectorAll('pre[data-tm-processed="true"]'));
        if (blocks.length === 0) {
            showToast('当前页面暂无代码块');
            return;
        }

        // 只要有一个处于展开状态，就全部折叠；否则全部展开
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

        showToast(targetCollapse
            ? `已全部折叠 (${blocks.length} 个代码块)`
            : `已全部展开 (${blocks.length} 个代码块)`
        );
    }

    window.addEventListener('keydown', (e) => {
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === SHORTCUT_KEY_CODE) {
            e.preventDefault();
            toggleAllCodeBlocks();
        }
    });

    // 延迟启动监听，避开 Gemini 首屏核心组件（菜单栏、模型选择器）的初始化水合期
    function initObserver() {
        injectStyles();
        document.querySelectorAll('pre').forEach(processCodeBlock);

        let rafId = null;
        const observer = new MutationObserver((mutations) => {
            // 过滤掉脚本自身节点（折叠条和提示框）引发的 DOM 变动，降低性能开销
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

    // 等待首屏 UI 框架挂载完成后再介入
    if (document.readyState === 'complete') {
        setTimeout(initObserver, 800);
    } else {
        window.addEventListener('load', () => setTimeout(initObserver, 800), { once: true });
    }
})();
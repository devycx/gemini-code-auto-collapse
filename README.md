# Gemini 代码块自动折叠

Gemini 网页版一次回你两三百行代码的时候，手机要划好几屏才能翻到后面的解释。这个油猴脚本把长代码块折叠成一行标题条，点开才展开。

- 安装：[Greasy Fork](https://greasyfork.org/zh-CN/scripts/605151)
- 源码：[GitHub](https://github.com/devycx/gemini-code-auto-collapse) · [直接安装 .user.js](https://raw.githubusercontent.com/devycx/gemini-code-auto-collapse/main/gemini-code-auto-collapse.user.js)
- 适用范围：`https://gemini.google.com/*`
- 版本：2.1.0

## 它做什么

1. **长代码自动折叠**：代码块达到 5 行就默认收起，短代码保持原样。
2. **折叠条带状态和行数**：`▶ 点击展开代码（共 42 行 | Alt+C 全局切换）`，展开后变成 `▼ 点击此处或代码区收起`。
3. **两种收起方式**：点折叠条展开；在展开状态下点代码区任意位置收起。
4. **防误触**：手指/鼠标移动超过 8px，或者页面上有选中文本（正在划词复制）时不触发折叠。
5. **Alt+C 全局切换**：页面上只要还有一个展开的代码块，就全部收起；否则全部展开，右上角有 Toast 提示数量。
6. **颜色跟随代码块**：折叠条文字颜色取 `code` 的计算样式，深色/浅色主题下都不会出现黑字压黑底。

## 配置

改脚本开头的两行即可，改完刷新页面：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `AUTO_COLLAPSE_THRESHOLD` | `5` | 达到多少行自动折叠；设为 `0` 则所有代码块（包括短代码）一律折叠 |
| `SHORTCUT_KEY_CODE` | `'KeyC'` | 全局切换键。改成 `'KeyZ'` 就是 Alt+Z |

## 实现要点

- **三态标记**：每个代码块在 `data-tm-auto-state` 上记 `pending` / `collapsed` / `manual`。Gemini 是流式输出，代码块刚出现时可能只有两行，等长到阈值再自动折叠一次；用户手动操作过的块不会被后续扫描重新折叠。
- **MutationObserver + requestAnimationFrame**：DOM 变动只做标记，真正扫描合并到下一帧，且同一帧只跑一次。
- **过滤自身改动**：折叠条和 Toast 也是 DOM 节点，Observer 会明确跳过它们，避免「插入折叠条 → 触发扫描 → 再插入」的循环。
- **文本只在变化时写**：折叠条显示的行数会随流式输出增长，脚本把上一次的文案存在 `dataset.lastText`，值没变就不碰 DOM，减少无意义的变动。
- **延迟 800ms 启动**：等 Gemini 首屏（侧栏、模型选择器）挂载完再介入，避开初始化水合期；已在 `load` 之后则直接延迟启动。
- **折叠不销毁节点**：用 `max-height: 0 + overflow: hidden + pointer-events: none` 收起，代码块 DOM 还在，页面的滚动位置不会因为节点被删而跳。

## 已知边界

- 只匹配 `gemini.google.com`，嵌在其他 Google 产品里的 Gemini 界面不生效。
- 行数按 `textContent` 的换行数算。压缩成一行的超长代码（比如 minified 的几千字符）不会被折叠——它本来也只占一行。
- 依赖 Gemini 当前的 `<pre>` 结构和 `message-content` / `code-block` 容器。Google 改版后选择器可能需要跟着改。
- `Alt+C` 是窗口级监听。如果某个页面自己占用了这个组合键，会在捕获阶段之后才轮到脚本，行为可能不一致。

## License

MIT，见 [LICENSE](LICENSE)。

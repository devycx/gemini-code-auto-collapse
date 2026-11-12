# Gemini 代码块自动折叠 (Auto Collapse Code)

一个跑在 Gemini 网页版 (`gemini.google.com`) 上的油猴脚本。Gemini 的回答里经常塞进几十上百行的代码墙，滚动阅读时非常碍事。本脚本自动把长代码块折叠成一行折叠条，点开即看，收起即走。

- 安装（Greasy Fork）：发布后补充链接
- 直接装（GitHub）：https://raw.githubusercontent.com/devycx/gemini-code-auto-collapse/main/gemini-code-auto-collapse.user.js
- 适用范围：`https://gemini.google.com/*`
- 版本：2.1.1

## 它做什么

1. **自动折叠长代码**：超过阈值行数（默认 5 行，可在文件顶部 `AUTO_COLLAPSE_THRESHOLD` 修改）的代码块一律默认折叠；设为 0 则所有代码块一律折叠。
2. **折叠条显示行数**：折叠条实时显示 ▶/▼ 状态、行数与操作提示，点击折叠条即可展开，点代码区任意处即收起。
3. **全局快捷键 Alt+C**：一键展开/收起页面上全部代码块，右上角 Toast 提示当前状态。
4. **防误触**：划词选中、拖动滚动代码、超过 8px 的移动都不会触发折叠；移动端触摸同样兼容。
5. **视觉自适应**：折叠条文字颜色自动同步代码块本身的前景色，浅色主题下不会出现黑字压黑底。

## 实现细节

- **零阻塞渲染**：MutationObserver 触发的扫描合并进 `requestAnimationFrame`，一帧最多处理一次，折叠条文本只在真正变化时才写入 DOM，杜绝与页面自身重绘形成死循环。
- **错峰启动**：监听器延迟 800ms 挂载，避开 Gemini 首屏组件（菜单栏、模型选择器）的初始化水合期。
- **折叠动画无闪烁**：用 `max-height/overflow` 收缩而非 `display:none`，移动端展开收起无跳动。
- **自我过滤**：Observer 明确忽略脚本自身节点（折叠条、Toast）引发的 DOM 变动。
- **折叠后回中**：收起超长代码块时若折叠条已滚出视口上方，自动平滑对齐到可视区域。

## 配置项

文件顶部两行即可改：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `AUTO_COLLAPSE_THRESHOLD` | 5 | 触发自动折叠的最小行数；0 = 一律折叠 |
| `SHORTCUT_KEY_CODE` | `'KeyC'` | 全局切换键，改成 `'KeyZ'` 即变为 Alt+Z |

## 已知边界

- 只匹配 `gemini.google.com`，Gemini 嵌入其他 Google 产品的界面不覆盖。
- 折叠判定以 `textContent` 的换行数为准，超长单行代码不会被折叠（也不需要）。
- 页面大改版导致 `<pre>` 结构变化时需等脚本更新选择器。

MIT License，详见 [LICENSE](LICENSE)。

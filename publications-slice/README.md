# Publications · 第二页 slice

从当前 Pageshare 第二页导出的可独立运行版本。三维图源码、图谱样式和 55 项工作数据直接复制自当前网站，包含 8 个主题。

## 打开

- 直接用浏览器打开 `publications-slice.html`：HTML、CSS、JavaScript、论文数据和 XL 图标全部内嵌。
- 修改源码时打开 `index.html`，它使用同目录下的拆分文件。
- 不需要 npm、React、Three.js 或后端。Google Fonts 为可选字体；断网时使用系统字体。
- 也可以在本目录运行 `python3 -m http.server 8080`，访问 `http://localhost:8080`。

## 文件

| 文件 | 内容 |
| --- | --- |
| `index.html` | 第二页的标题、统计句、项目名单、图谱容器和页脚 |
| `research-map.js` | 当前原版三维布局、投影、曲面/线框绘制、深度明暗、旋转和交互 |
| `research-map.css` | 当前原版图谱样式 |
| `projects.js` | 当前原版 55 项工作数据，包括主题归属、缩写和资源链接 |
| `publications.js` | 从原 `app.js` 提取的主题定义、统计、会议格式和图谱初始化 |
| `slice.css` | 从原全站样式提取的页面布局，以及独立预览弹窗样式 |
| `preview-dialog.js` | 独立预览里的论文摘要、资源链接和主题目录 |
| `favicon.svg` | XL 方块图标 |
| `publications-slice.html` | 当前版本的单文件快照 |

原站点击论文会跳到论文 slides，点击主题的 ↗ 会打开左侧目录。本包只包含第二页，因此独立预览用弹窗展示论文摘要、资源链接和主题目录，不包含后续 233 页论文内容或项目媒体。接入原站/其他网站时替换下面两个回调即可。

## 接入你的网站

在加载 `publications.js` **之前**设置：

```html
<script>
  window.PUBLICATIONS_SLICE_OPTIONS = {
    openPaper(id) {
      // 原站的论文锚点；你的页面需要有对应的论文 section。
      location.hash = `paper-${id}`;
    },
    openTopic(id) {
      // 替换成你自己的目录或路由逻辑。
      console.log("打开主题目录", id);
    }
  };
</script>
<script src="publications.js"></script>
```

也可以直接调用原始组件：

```js
ResearchMap.create(document.querySelector("#theme-map"), {
  projects: window.PROJECTS,
  themes: window.PUBLICATION_THEMES,
  shortVenue: paper => paper.venue,
  openPaper: id => { /* 你的论文详情逻辑 */ },
  openTopic: id => { /* 你的主题目录逻辑 */ }
});
```

上面两种初始化方式选择一种，每个容器初始化一次。`PUBLICATION_THEMES` 在 `publications.js` 中定义，直接使用组件时可复制其中的主题数组。修改拆分文件后，`index.html` 会使用最新代码；`publications-slice.html` 是本次导出时的快照。

## 当前行为与数据口径

- 所有主题共享一个 XYZ 坐标系；多主题论文位于相应体积交集内。
- 自动旋转时鼠标悬停仍然转动；支持拖拽、滚轮、双指、方向键、暂停和复位。
- 多选主题高亮所选主题论文的并集。
- 55 个论文缩写持续显示，前方更亮、后方更暗；文字固定跟随点，允许前方覆盖后方。
- 主题标志连续沿椭球轮廓移动；椭球保留曲面光照与前后线框。
- 保留离屏暂停和系统“减少动态效果”偏好。
- 标题旁的 27 篇顶会、13 篇一作/共一、2 Highlight、1 Workshop Best Paper、4 Oral、12 Project Lead 是作者提供的汇总。页脚按收录数据计算，两者口径不同。
- 坐标表达主题归属，不表示论文分数或实测相似度。增加新主题时需要同时更新 `research-map.js` 的 `regionSpecs`、`topicAngles` 和 `legendLabels`；新的主题组合必须存在可行的几何交集。

导出日期：2026-11-21。

/* Only used by the standalone demo; replace these callbacks in your site. */
window.PublicationPreview = (() => {
  const dialog = document.querySelector("#slice-detail");
  const title = document.querySelector("#slice-detail-title");
  const content = document.querySelector("#slice-detail-content");
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let papers, themes, shortVenue;

  function show() {
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }

  function openPaper(id) {
    const paper = papers.find(item => item.id === id);
    if (!paper) return;
    title.textContent = paper.title;
    content.replaceChildren(
      element("p", shortVenue(paper), "paper-venue"),
      element("p", paper.summary || "")
    );
    const tags = element("div", null, "paper-topics");
    paper.themes.forEach(topic => tags.append(element("span", themes.find(item => item.id === topic)?.label || topic)));
    content.append(tags);
    const links = element("nav", null, "paper-links");
    links.setAttribute("aria-label", "论文与项目资源");
    for (const resource of paper.links || []) {
      try {
        const url = new URL(resource.url);
        if (!["http:", "https:"].includes(url.protocol)) continue;
        const link = element("a", resource.label + " ↗");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        links.append(link);
      } catch { /* Ignore incomplete resource URLs. */ }
    }
    if (links.childElementCount) content.append(links);
    show();
  }

  function openTopic(id) {
    const theme = themes.find(item => item.id === id);
    if (!theme) return;
    const members = papers.filter(paper => paper.themes.includes(id));
    title.textContent = theme.label;
    const list = element("ul", null, "topic-paper-list");
    for (const paper of members) {
      const item = element("li");
      const button = element("button");
      button.type = "button";
      button.append(element("span", paper.shortTitle), element("small", shortVenue(paper)));
      button.addEventListener("click", () => openPaper(paper.id));
      item.append(button);
      list.append(item);
    }
    content.replaceChildren(element("p", `${members.length} 项工作`), list);
    show();
  }

  return {
    configure(data) { ({ papers, themes, shortVenue } = data); },
    openPaper,
    openTopic,
  };
})();

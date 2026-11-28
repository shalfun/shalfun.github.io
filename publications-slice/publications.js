/* Themes, summary and venue formatting extracted from the current app.js. */
(() => {
  const papers = window.PROJECTS || [];
  const themes = window.PUBLICATION_THEMES = [
    { id: "3d", label: "3D Vision / Generation", color: "#e7aa77" },
    { id: "media", label: "Image / Video Generation", color: "#a7b9ef" },
    { id: "llm", label: "LLM / MLLM", color: "#c3a7f0" },
    { id: "embodied", label: "VLA · Embodied Models", color: "#d5ef80" },
    { id: "infra", label: "Model Infrastructure", color: "#82d4bd" },
    { id: "robotics", label: "Robotics", color: "#f0c975" },
    { id: "driving", label: "Autonomous Driving", color: "#ed947b" },
    { id: "worldmodel", label: "World Models", color: "#8ed2c7" },
    { id: "simulation", label: "Simulation", color: "#6f9ed4" },
  ];

  function shortVenue(paper) {
    const venue = paper.venue || "";
    if (/under review/i.test(venue)) return "UNDER REVIEW";
    const honor = /\[(.*?)\]/.exec(venue)?.[1];
    const names = ["CVPR", "ICCV", "ECCV", "ICML", "ICRA", "IJCAI", "SIGGRAPH", "TPAMI", "TMM", "ICIP", "TIP", "ACM MM", "RAL"];
    const name = names.find(candidate => venue.toUpperCase().includes(candidate));
    const year = /\b20\d{2}\b/.exec(venue)?.[0] || String(paper.year || "");
    if (name) return `${name}${/workshop/i.test(venue) ? " Workshop" : ""}${year ? ` ${year}` : ""}${honor ? ` · ${honor.toUpperCase()}` : ""}`;
    if (/arXiv/i.test(venue)) return `arXiv · ${paper.arxiv || year}`;
    return `${venue.replace(/\s*,\s*20\d{2}.*$/, "")} ${year}`.trim();
  }

  function renderPublicationSummary() {
    // Owner-provided totals are independent of the archive's per-work metadata.
    const honors = [[2, "Highlight", "highlight"], [1, "Workshop Best Paper", "best-paper"], [4, "Oral", "oral"]]
      .map(([count, label, id]) => `<span class="publication-phrase"><strong data-stat="${id}">${count}</strong> ${label}</span>`).join(" · ");
    document.querySelector("#publication-summary").innerHTML = `<strong data-stat="top-conference">27</strong> papers accepted to top-tier conference main tracks, including <strong id="first-count" data-stat="first-author">13</strong> as first / co-first author <span class="publication-honors">(${honors})</span> and <span class="publication-phrase">Project Lead on <strong data-stat="project-lead">12</strong>.</span>`;
    const setText = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    setText("#unique-count", papers.length);
    setText("#field-count", themes.length);
    setText("#accepted-count", papers.filter(paper => paper.status === "published").length);
  }

  renderPublicationSummary();
  window.PublicationPreview.configure({ papers, themes, shortVenue });
  const options = window.PUBLICATIONS_SLICE_OPTIONS || {};
  window.publicationMap = window.ResearchMap.create(document.querySelector("#theme-map"), {
    projects: papers,
    themes,
    shortVenue,
    openPaper: options.openPaper || window.PublicationPreview.openPaper,
    openTopic: options.openTopic || window.PublicationPreview.openTopic,
  });
})();

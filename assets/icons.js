(function () {
  const icons = {
    "arrow-left": '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    "boxes": '<path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    "briefcase-business": '<path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 13h18"/><path d="M10 13v2h4v-2"/>',
    "copy": '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    "factory": '<path d="M3 21h18"/><path d="M5 21V9l5 3V9l5 3V5h4v16"/><path d="M9 17h1"/><path d="M14 17h1"/>',
    "file-stack": '<path d="M14 2H7a2 2 0 0 0-2 2v14"/><path d="M10 6h7l3 3v11a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M17 6v4h4"/>',
    "file-up": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>',
    "git-compare-arrows": '<path d="M6 3v12"/><path d="m3 12 3 3 3-3"/><path d="M18 21V9"/><path d="m15 12 3-3 3 3"/><path d="M6 3h8a4 4 0 0 1 4 4v2"/><path d="M18 21h-8a4 4 0 0 1-4-4v-2"/>',
    "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "layers-3": '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    "list": '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>',
    "handshake": '<path d="m11 17 2 2a2.8 2.8 0 0 0 4 0l3-3a2.8 2.8 0 0 0 0-4l-5-5a2.8 2.8 0 0 0-4 0l-.5.5"/><path d="m13 7 4 4"/><path d="m5 12 4-4a2.8 2.8 0 0 1 4 0l.5.5"/><path d="m2 15 3 3a2.8 2.8 0 0 0 4 0l2-2"/>',
    "package-plus": '<path d="m16.5 9.4-9-5.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/><path d="M19 15v6"/><path d="M16 18h6"/>',
    "panel-top-open": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="m9 16 3-3 3 3"/>',
    "pencil": '<path d="M21.2 6.8 17.2 2.8a2 2 0 0 0-2.8 0L4 13.2V20h6.8L21.2 9.6a2 2 0 0 0 0-2.8Z"/><path d="m14 4 6 6"/>',
    "printer": '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/><path d="M18 12h.01"/>',
    "refresh-cw": '<path d="M21 12a9 9 0 0 1-15.3 6.4L3 16"/><path d="M3 21v-5h5"/><path d="M3 12A9 9 0 0 1 18.3 5.6L21 8"/><path d="M21 3v5h-5"/>',
    "save": '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    "search": '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    "shield-check": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    "ship": '<path d="M2 20c.9.6 1.8 1 3 1s2.1-.4 3-1c.9.6 1.8 1 3 1s2.1-.4 3-1c.9.6 1.8 1 3 1s2.1-.4 3-1"/><path d="M4 18 2 10h20l-2 8"/><path d="M12 10V3"/><path d="M7 10V6h10v4"/>',
    "shopping-bag": '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
    "shopping-cart": '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 6H6"/>',
    "sliders-horizontal": '<path d="M21 4h-7"/><path d="M10 4H3"/><path d="M21 12h-9"/><path d="M8 12H3"/><path d="M21 20h-5"/><path d="M12 20H3"/><circle cx="12" cy="4" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="14" cy="20" r="2"/>',
    "tags": '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r=".5"/><path d="m7 7 .01 0"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    "user-cog": '<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 12.4-6.7"/><circle cx="18" cy="18" r="3"/><path d="M18 13.5V15"/><path d="M18 21v1.5"/><path d="m14.1 15.8 1.3.8"/><path d="m20.6 20.4 1.3.8"/><path d="m14.1 20.2 1.3-.8"/><path d="m20.6 15.6 1.3-.8"/>',
    "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
    "user-plus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    "user-round": '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    "user-x": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m17 8 5 5"/><path d="m22 8-5 5"/>',
    "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };

  function createIcon(name, attrs) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    Object.entries(attrs || {}).forEach(([key, value]) => svg.setAttribute(key, value));
    svg.innerHTML = icons[name] || icons.boxes;
    return svg;
  }

  window.CatalogIcons = {
    createIcons(options = {}) {
      document.querySelectorAll("[data-lucide]").forEach((node) => {
        const svg = createIcon(node.getAttribute("data-lucide"), options.attrs);
        node.replaceWith(svg);
      });
    }
  };
})();

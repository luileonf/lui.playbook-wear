window.luiIconSvg = function iconSvg(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.2v-6.4H8.7V21H3.5a.5.5 0 0 1-.5-.5v-9.7Z"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.2h14v2H5v-2Zm0 4.8h14v2H5v-2Zm0 4.8h14v2H5v-2Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V9h3v11H5Zm5.5 0V4h3v16h-3Zm5.5 0v-7h3v7h-3Z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.4 13.3a7.8 7.8 0 0 0 0-2.6l2-1.5-2-3.4-2.4 1a8.2 8.2 0 0 0-2.2-1.3L14.5 3h-5l-.4 2.5A8.2 8.2 0 0 0 7 6.8l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 2.6l-2 1.5 2 3.4 2.4-1a8.2 8.2 0 0 0 2.2 1.3l.4 2.5h5l.4-2.5a8.2 8.2 0 0 0 2.2-1.3l2.4 1 2-3.4-2.2-1.5ZM12 15.4A3.4 3.4 0 1 1 12 8.6a3.4 3.4 0 0 1 0 6.8Z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.2 8.1A7.2 7.2 0 0 0 5.7 6.8L4.1 5.2V10h4.8L7.1 8.2a5 5 0 0 1 8.9 1.3l2.2-1.4ZM5.8 15.9a7.2 7.2 0 0 0 12.5 1.3l1.6 1.6V14h-4.8l1.8 1.8a5 5 0 0 1-8.9-1.3l-2.2 1.4Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20.2 18.8-4.1-4.1a7 7 0 1 0-1.4 1.4l4.1 4.1 1.4-1.4ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7a3 3 0 0 0 5.8 0H20V5h-3.2a3 3 0 0 0-5.8 0H4v2Zm0 12h3.2a3 3 0 0 0 5.8 0h7v-2h-7a3 3 0 0 0-5.8 0H4v2Zm0-6h13v-2H4v2Z"/></svg>',
    credit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11ZM5 8v2h14V8H5Zm0 7v2h6v-2H5Z"/></svg>',
  };

  return icons[name] || "";
};

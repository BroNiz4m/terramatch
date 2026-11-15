const paths = {
  temperature:'<path d="M9 14.8V5a3 3 0 0 1 6 0v9.8a5 5 0 1 1-6 0Z"/><path d="M12 8v10"/><circle cx="12" cy="19" r="1.5"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',
  play:'<path d="m8 5 11 7-11 7Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  terrain:'<path d="m2 19 7-13 5 8 3-5 5 10ZM7 10l3 2 2-1"/>',
  layers:'<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 5 9-5M3 18l9 5 9-5"/>',
  globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  source:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  compare:'<rect x="2" y="5" width="12" height="12" rx="2"/><path d="M10 2h10a2 2 0 0 1 2 2v10M8 17v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  warning:'<path d="m12 3 10 18H2ZM12 9v5m0 3v1"/>',
  rocket:'<path d="M8 16V9c0-4 4-7 4-7s4 3 4 7v7ZM8 10 3 16v4l5-2m8-8 5 6v4l-5-2M9 21l3 2 3-2"/><circle cx="12" cy="10" r="1.5"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  external:'<path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6"/>',
  robot:'<rect x="5" y="6" width="14" height="11" rx="3"/><path d="M12 6V3M5 8 1 5M5 12l-4 1m4 3-3 5M19 8l4-3m-4 7 4 1m-4 3 3 5"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2"/>',
  bookmark:'<path d="M6 3h12v19l-6-4-6 4Z"/>'
};
export function icon(name, cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.globe}</svg>`; }
export function escapeHTML(value='') { return String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

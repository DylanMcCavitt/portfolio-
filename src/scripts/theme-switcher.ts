const STORAGE_KEY = "portfolio-theme";
const VALID_THEMES = [
  "nord",
  "dracula",
  "rose-pine",
  "gruvbox",
  "everforest",
  "night-owl",
  "dark-plus",
];

const THEME_NAMES: Record<string, string> = {
  nord: "nord",
  dracula: "dracula",
  "rose-pine": "rosé pine",
  gruvbox: "gruvbox",
  everforest: "everforest",
  "night-owl": "night owl",
  "dark-plus": "dark+",
};

function hasUserChosenTheme(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

function getTheme(): string {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && VALID_THEMES.includes(stored) ? stored : "nord";
}

function setTheme(themeId: string): void {
  document.documentElement.setAttribute("data-theme", themeId);
  localStorage.setItem(STORAGE_KEY, themeId);
  updateAllInstances(themeId);
}

function getToggleLabel(themeId: string): string {
  if (!hasUserChosenTheme()) return "[/theme]";
  return `${THEME_NAMES[themeId] || themeId} ▾`;
}

function updateAllInstances(themeId: string): void {
  // Update all active states on dropdown items
  const items = document.querySelectorAll<HTMLElement>(
    ".palette-nav__dropdown-item",
  );
  items.forEach((item) => {
    item.setAttribute("data-active", String(item.dataset.themeId === themeId));
  });

  // Update all toggle labels
  const label = getToggleLabel(themeId);
  document
    .querySelectorAll<HTMLElement>("[data-theme-toggle]")
    .forEach((toggle) => {
      toggle.textContent = label;
    });
}

function initInstance(toggle: HTMLElement, dropdown: HTMLElement): void {
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    // Close all other dropdowns first
    document
      .querySelectorAll<HTMLElement>("[data-theme-dropdown]")
      .forEach((d) => {
        if (d !== dropdown) {
          d.hidden = true;
          d.previousElementSibling?.setAttribute("aria-expanded", "false");
        }
      });
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    dropdown.hidden = isOpen;
  });

  dropdown.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>(
      ".palette-nav__dropdown-item",
    );
    if (!item?.dataset.themeId) return;
    setTheme(item.dataset.themeId);
    toggle.setAttribute("aria-expanded", "false");
    dropdown.hidden = true;
  });
}

function initThemeSwitcher(): void {
  const currentTheme = getTheme();

  // Find all toggle/dropdown pairs by data attributes
  const toggles = document.querySelectorAll<HTMLElement>("[data-theme-toggle]");
  const dropdowns = document.querySelectorAll<HTMLElement>(
    "[data-theme-dropdown]",
  );

  toggles.forEach((toggle, i) => {
    const dropdown = dropdowns[i];
    if (!dropdown) return;
    initInstance(toggle, dropdown);
  });

  updateAllInstances(currentTheme);

  // Global: close on outside click
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest("[data-theme-toggle]") &&
      !target.closest("[data-theme-dropdown]")
    ) {
      document
        .querySelectorAll<HTMLElement>("[data-theme-dropdown]")
        .forEach((d) => {
          d.hidden = true;
        });
      toggles.forEach((t) => t.setAttribute("aria-expanded", "false"));
    }
  });

  // Global: close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document
        .querySelectorAll<HTMLElement>("[data-theme-dropdown]")
        .forEach((d) => {
          d.hidden = true;
        });
      toggles.forEach((t) => t.setAttribute("aria-expanded", "false"));
    }
  });
}

initThemeSwitcher();

function initLightbox(): void {
  document.addEventListener("click", (e) => {
    const img = (e.target as HTMLElement).closest<HTMLImageElement>(
      ".project-content img, .screenshot-grid img",
    );
    if (!img) return;

    const overlay = document.createElement("div");
    overlay.className = "lightbox";

    const fullImg = document.createElement("img");
    fullImg.src = img.src;
    fullImg.alt = img.alt;
    overlay.appendChild(fullImg);

    overlay.addEventListener("click", (ev) => {
      if (ev.target !== fullImg) overlay.remove();
    });

    document.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key === "Escape") overlay.remove();
      },
      { once: true },
    );

    document.body.appendChild(overlay);
  });
}

initLightbox();

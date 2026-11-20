export async function loadSections(sectionsMap) {
  const entries = Object.entries(sectionsMap);

  await Promise.all(
    entries.map(async ([selector, sectionUrl]) => {
      const target = document.querySelector(selector);
      if (!target) return;

      const response = await fetch(sectionUrl);
      if (!response.ok) {
        throw new Error(`Gagal memuat section: ${sectionUrl} (${response.status})`);
      }

      target.innerHTML = await response.text();
    })
  );
}
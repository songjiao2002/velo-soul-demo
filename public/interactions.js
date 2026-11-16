function mountLanguageChoices(select) {
  const group = document.createElement("div");
  group.className = "language-options";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", select.id + "Label");
  group.dataset.noTranslate = "";

  const choices = Array.from(select.options, (option, index) => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = select.id + "Choice";
    radio.value = option.value;

    const caption = document.createElement("span");
    caption.lang = option.lang;
    caption.textContent = option.textContent;
    label.append(radio, caption);
    group.append(label);
    radio.addEventListener("change", () => {
      if (radio.checked) group.style.setProperty("--choice-index", index);
    });
    return radio;
  });

  function sync() {
    const selected = choices.findIndex((choice) => choice.value === select.value);
    if (selected < 0) return;
    choices[selected].checked = true;
    group.style.setProperty("--choice-index", selected);
  }

  select.hidden = true;
  group.style.setProperty("--choice-count", choices.length);
  select.after(group);
  sync();
  return {
    select,
    sync,
    draft: () => choices.find((choice) => choice.checked)?.value ?? select.value,
  };
}

function setupSettings() {
  const dialog = document.getElementById("appSettingsDialog");
  const settings = Array.from(dialog.querySelectorAll(".preference-controls select"), mountLanguageChoices);
  const sync = () => settings.forEach((entry) => entry.sync());

  // Opening a new editing session starts from the most recently saved values.
  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="settings"]')) sync();
  }, { capture: true });
  dialog.addEventListener("close", sync);

  dialog.querySelector("[data-save-settings]").addEventListener("click", () => {
    const changed = [];
    for (const { select, draft } of settings) {
      const value = draft();
      if (value === select.value) continue;
      select.value = value;
      changed.push(select);
    }
    dialog.close();
    for (const select of changed) select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

if (document.documentElement.dataset.veloReady === "true") {
  setupSettings();
} else {
  window.addEventListener("velo:ready", setupSettings, { once: true });
}

function openTranslationMenu() {
  return document.querySelector(".diary-translation[open]");
}
document.addEventListener("click", (event) => {
  const menu = openTranslationMenu();
  if (menu && !menu.contains(event.target)) menu.open = false;
}, { capture: true });
document.addEventListener("keydown", (event) => {
  const menu = openTranslationMenu();
  if (event.key !== "Escape" || !menu) return;
  menu.open = false;
  menu.querySelector("summary").focus({ preventScroll: true });
});

let diaryPress;
function cancelDiaryPress() {
  if (!diaryPress) return;
  clearTimeout(diaryPress.timer);
  diaryPress = null;
}

document.addEventListener("pointerdown", (event) => {
  const card = event.target.closest(".diary-card-open");
  if (!card || !event.isPrimary || event.button !== 0) return;
  cancelDiaryPress();
  diaryPress = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    timer: setTimeout(() => {
      cancelDiaryPress();
      if (card.isConnected) card.click();
    }, 500),
  };
});
document.addEventListener("pointermove", (event) => {
  if (diaryPress?.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - diaryPress.x, event.clientY - diaryPress.y) > 10) cancelDiaryPress();
});
for (const type of ["pointerup", "pointercancel"]) {
  document.addEventListener(type, (event) => {
    if (diaryPress?.id === event.pointerId) cancelDiaryPress();
  });
}
document.addEventListener("contextmenu", (event) => {
  if (event.target.closest(".diary-card-open")) event.preventDefault();
});

document.getElementById("deleteDiaryDialog").addEventListener("cancel", (event) => {
  if (document.getElementById("deleteDiaryConfirm").disabled) event.preventDefault();
});

const sections = [...document.querySelectorAll(".chapter")];
const worldMap = document.getElementById("world-map");
const questRail = document.getElementById("quest-rail");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("mission-progress-fill");
const missionCount = document.getElementById("mission-count");
const activeZone = document.getElementById("active-zone");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const meta = sections.map((section, index) => ({
  section,
  index,
  label: section.dataset.label,
  short: section.dataset.short,
  accent: section.dataset.accent,
  nodeX: Number(section.dataset.nodeX),
  nodeY: Number(section.dataset.nodeY),
  camX: Number(section.dataset.camX),
  camY: Number(section.dataset.camY),
  scale: Number(section.dataset.scale),
}));

const worldNodes = [];
const railDots = [];
let sectionCenters = [];
let activeIndex = -1;
let ticking = false;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start, end, amount) => start + (end - start) * amount;
const smoothstep = (value) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

function buildNavigation() {
  meta.forEach((item, index) => {
    const node = document.createElement("span");
    node.className = "world-node";
    node.style.left = `${item.nodeX}%`;
    node.style.top = `${item.nodeY}%`;
    node.style.setProperty("--node-accent", item.accent);
    node.innerHTML = `
      <i class="world-node__beam"></i>
      <i class="world-node__ring"></i>
      <i class="world-node__core"></i>
      <span class="world-node__label">${String(index + 1).padStart(2, "0")} · ${item.short}</span>
    `;
    worldMap.appendChild(node);
    worldNodes.push(node);

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "quest-dot";
    dot.dataset.label = item.label;
    dot.setAttribute("aria-label", `Go to ${item.label}`);
    dot.addEventListener("click", () => scrollToMission(index));
    questRail.appendChild(dot);
    railDots.push(dot);
  });
}

function measure() {
  sectionCenters = sections.map((section) => section.offsetTop + section.offsetHeight * 0.5);
  updateWorld();
}

function scrollToMission(index) {
  sections[index]?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "center",
  });
}

function setActive(index) {
  if (index === activeIndex || !meta[index]) return;
  activeIndex = index;
  const current = meta[index];

  sections.forEach((section, sectionIndex) => {
    section.classList.toggle("is-active", sectionIndex === index);
  });

  worldNodes.forEach((node, nodeIndex) => {
    node.classList.toggle("is-active", nodeIndex === index);
  });

  railDots.forEach((dot, dotIndex) => {
    const isCurrent = dotIndex === index;
    dot.classList.toggle("is-active", isCurrent);
    if (isCurrent) dot.setAttribute("aria-current", "location");
    else dot.removeAttribute("aria-current");
  });

  activeZone.textContent = current.label;
  missionCount.textContent = `${String(index + 1).padStart(2, "0")} / ${String(meta.length).padStart(2, "0")}`;
}

function getCameraState(scrollCenter) {
  if (scrollCenter <= sectionCenters[0]) {
    return { from: 0, to: 0, mix: 0 };
  }

  const last = sectionCenters.length - 1;
  if (scrollCenter >= sectionCenters[last]) {
    return { from: last, to: last, mix: 0 };
  }

  for (let index = 0; index < last; index += 1) {
    const start = sectionCenters[index];
    const end = sectionCenters[index + 1];
    if (scrollCenter >= start && scrollCenter <= end) {
      const linear = (scrollCenter - start) / (end - start);
      return { from: index, to: index + 1, mix: reduceMotion ? Math.round(linear) : smoothstep(linear) };
    }
  }

  return { from: 0, to: 0, mix: 0 };
}

function updateWorld() {
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollCenter = scrollY + window.innerHeight * 0.5;
  const state = getCameraState(scrollCenter);
  const from = meta[state.from];
  const to = meta[state.to];
  const mix = state.mix;
  const nearestIndex = mix < 0.5 ? state.from : state.to;
  const camX = lerp(from.camX, to.camX, mix);
  const camY = lerp(from.camY, to.camY, mix);
  const scale = lerp(from.scale, to.scale, mix);
  const accent = mix < 0.5 ? from.accent : to.accent;

  document.documentElement.style.setProperty("--cam-x", `${camX.toFixed(2)}vw`);
  document.documentElement.style.setProperty("--cam-y", `${camY.toFixed(2)}vh`);
  document.documentElement.style.setProperty("--cam-scale", scale.toFixed(3));
  document.documentElement.style.setProperty("--node-inverse", (1 / scale).toFixed(3));
  document.documentElement.style.setProperty("--accent", accent);

  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = clamp(scrollY / scrollable);
  progressBar.style.transform = `scaleY(${progress})`;
  progressFill.style.transform = `scaleX(${progress})`;

  setActive(nearestIndex);
  ticking = false;
}

function requestUpdate() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(updateWorld);
}

function addPointerParallax() {
  if (reduceMotion || coarsePointer) return;

  window.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * -10;
    const y = (event.clientY / window.innerHeight - 0.5) * -7;
    document.documentElement.style.setProperty("--pointer-x", `${x.toFixed(2)}px`);
    document.documentElement.style.setProperty("--pointer-y", `${y.toFixed(2)}px`);
  }, { passive: true });
}

buildNavigation();
measure();
addPointerParallax();

window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", measure);
window.addEventListener("load", measure);

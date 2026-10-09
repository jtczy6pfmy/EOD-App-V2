(() => {
  "use strict";

  const HARRISBURG_MILESTONES = {
    8:  { icon: "🎯", title: "25% COMPLETE!", subtitle: "8 / 30 INSPECTIONS", color: "#22B7F0", highlight: "#A8EEFF" },
    15: { icon: "👽", title: "50% COMPLETE!", subtitle: "15 / 30 INSPECTIONS", color: "#65D64A", highlight: "#C8FFB8" },
    23: { icon: "⚡", title: "75% COMPLETE!", subtitle: "23 / 30 INSPECTIONS", color: "#FF7A35", highlight: "#FFD0A8" },
    30: { icon: "🏆", title: "DAILY TARGET COMPLETE!", subtitle: "30 / 30 INSPECTIONS", color: "#F04B32", highlight: "#FFB0A5" }
  };

  const STANDARD_MILESTONES = {
    7:  { icon: "🎯", title: "25% COMPLETE!", subtitle: "7 / 28 INSPECTIONS", color: "#22B7F0", highlight: "#A8EEFF" },
    14: { icon: "👽", title: "50% COMPLETE!", subtitle: "14 / 28 INSPECTIONS", color: "#65D64A", highlight: "#C8FFB8" },
    21: { icon: "⚡", title: "75% COMPLETE!", subtitle: "21 / 28 INSPECTIONS", color: "#FF7A35", highlight: "#FFD0A8" },
    28: { icon: "🏆", title: "DAILY TARGET COMPLETE!", subtitle: "28 / 28 INSPECTIONS", color: "#F04B32", highlight: "#FFB0A5" }
  };

  function isHarrisburg() {
    const terminal = document.getElementById("terminal");
    return terminal && terminal.value === "HARRISBURG";
  }

  function getMilestones() {
    return isHarrisburg() ? HARRISBURG_MILESTONES : STANDARD_MILESTONES;
  }

  function getTarget() {
    return isHarrisburg() ? 30 : 28;
  }

  let lastTotal = null;
  let showing = false;
  let savedTerminalNodes = null;

  function getColor(total) {
    const milestones = getMilestones();
    for (const mark of Object.keys(milestones).map(Number).sort((a, b) => b - a)) {
      if (total >= mark) return milestones[mark].color;
    }
    return "#ffc107";
  }

  function getHighlight(total) {
    const milestones = getMilestones();
    for (const mark of Object.keys(milestones).map(Number).sort((a, b) => b - a)) {
      if (total >= mark) return milestones[mark].highlight;
    }
    return "#FFE47A";
  }

  function showInTerminal(milestone) {
    if (showing) return;
    const terminal = document.getElementById("terminal");
    const body = terminal?.closest(".card")?.querySelector(".card-body");
    if (!body) return;

    showing = true;
    savedTerminalNodes = Array.from(body.childNodes);
    const panel = document.createElement("div");
    panel.className = "eod-milestone";
    panel.style.cssText = `min-height:168px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-radius:10px;color:#fff;background:linear-gradient(135deg,${milestone.color},#101827 55%,#05070D);`;
    panel.innerHTML = `<div style="font-size:3.6rem;line-height:1;margin-bottom:8px">${milestone.icon}</div><div style="font-size:1.45rem;font-weight:900;letter-spacing:.7px">${milestone.title}</div><div style="margin-top:6px;font-size:.9rem;font-weight:800;letter-spacing:.8px">${milestone.subtitle}</div>`;
    body.replaceChildren(panel);

    setTimeout(() => {
      if (savedTerminalNodes) body.replaceChildren(...savedTerminalNodes);
      savedTerminalNodes = null;
      showing = false;
    }, 2800);
  }

  function update(total, initial = false) {
    const count = Number(total) || 0;
    const milestones = getMilestones();
    const fill = document.getElementById("fill");

    if (fill) {
      const color = getColor(count);
      fill.style.backgroundColor = color;
      fill.style.setProperty("--milestone-color", color);
      fill.style.setProperty("--milestone-highlight", getHighlight(count));
    }

    if (initial) {
      const reached = Object.keys(milestones).map(Number).filter(mark => count >= mark).sort((a, b) => b - a)[0];
      if (reached) showInTerminal(milestones[reached]);
    } else if (milestones[count] && count !== lastTotal) {
      showInTerminal(milestones[count]);
    }
    lastTotal = count;
  }

  function watchCount() {
    const count = document.getElementById("count");
    const terminal = document.getElementById("terminal");
    if (!count || !terminal) {
      requestAnimationFrame(watchCount);
      return;
    }

    const refresh = () => update(Number.parseInt(count.textContent, 10) || 0, true);
    refresh();
    new MutationObserver(() => update(Number.parseInt(count.textContent, 10) || 0, false)).observe(count, { childList: true, characterData: true, subtree: true });
    terminal.addEventListener("change", () => {
      lastTotal = null;
      update(Number.parseInt(count.textContent, 10) || 0, true);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchCount, { once: true });
  } else {
    watchCount();
  }

  window.EODMilestones = { update, getColor, getHighlight, getTarget, TARGET: getTarget };
})();

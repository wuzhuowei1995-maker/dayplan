(() => {
  const app = document.getElementById("app");
  const TH = 42;

  const parseTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const displayTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    return `${String(h % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  function logicalNow(now = new Date()) {
    let day = now.getDay();
    let minute = now.getHours() * 60 + now.getMinutes();

    // 00:00–03:59 仍算前一天晚上的延续。
    if (minute < 240) {
      day = (day + 6) % 7;
      minute += 1440;
    }

    return { day, minute };
  }

  function tasksForDay(day) {
    return (window.SCHEDULE[day] || []).map((r) => ({
      startText: r[0],
      endText: r[1],
      start: parseTime(r[0]),
      end: parseTime(r[1]),
      title: r[2],
      note: r[3] || "",
      day
    }));
  }

  function findCurrentIndex(tasks, minute) {
    let i = tasks.findIndex((t) => minute >= t.start && minute < t.end);
    if (i >= 0) return i;

    i = tasks.findIndex((t) => t.start > minute);
    return i >= 0 ? i : Math.max(tasks.length - 1, 0);
  }

  function buildTimeline() {
    const now = logicalNow();
    const todayTasks = tasksForDay(now.day);
    const baseToday = findCurrentIndex(todayTasks, now.minute);

    const timeline = [];

    // 当前项 + 今天剩余安排。
    for (let i = baseToday; i < todayTasks.length; i++) {
      timeline.push({ ...todayTasks[i], relativeDay: 0, originalIndex: i });
    }

    // 再接下一天完整安排，避免凌晨/当天末尾无法继续滑。
    const nextDay = (now.day + 1) % 7;
    const nextTasks = tasksForDay(nextDay);
    for (let i = 0; i < nextTasks.length; i++) {
      timeline.push({ ...nextTasks[i], relativeDay: 1, originalIndex: i });
    }

    return { now, timeline };
  }

  let state = buildTimeline();
  let view = 0;
  let busy = false;

  function dayLabel(task, index) {
    if (index === 0) return "现在";
    if (task.relativeDay === 0) return "今天稍后";
    return "明天";
  }

  function makeCard(task, index, cls = "") {
    const el = document.createElement("section");
    el.className = `card ${cls}`.trim();

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${window.DAY_NAMES[task.day]} · ${dayLabel(task, index)} · ${displayTime(task.startText)}–${displayTime(task.endText)}`;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = task.title;

    el.append(meta, title);

    if (task.note) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent = task.note;
      el.appendChild(note);
    }

    return el;
  }

  function render(reset = false) {
    state = buildTimeline();
    if (reset) view = 0;
    view = Math.min(view, Math.max(state.timeline.length - 1, 0));
    app.replaceChildren();

    if (!state.timeline.length) {
      const empty = document.createElement("section");
      empty.className = "card";
      empty.textContent = "没有安排";
      app.appendChild(empty);
      return;
    }

    app.appendChild(makeCard(state.timeline[view], view));
  }

  function move(dir) {
    if (busy || !state.timeline.length) return;

    const target = view + dir;
    if (target < 0 || target >= state.timeline.length) return;

    busy = true;
    const old = app.querySelector(".card");
    view = target;

    const enterClass = dir > 0 ? "enter-up" : "enter-down";
    const exitClass = dir > 0 ? "exit-up" : "exit-down";
    const next = makeCard(state.timeline[view], view, enterClass);
    app.appendChild(next);

    requestAnimationFrame(() => {
      old?.classList.add(exitClass);
      next.classList.add("enter-active");
    });

    setTimeout(() => {
      old?.remove();
      next.classList.remove("enter-up", "enter-down", "enter-active");
      busy = false;
    }, 190);
  }

  function handleSwipe(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < TH) return;

    if (Math.abs(dy) >= Math.abs(dx)) {
      if (dy < 0) move(1);
      else move(-1);
    } else {
      if (dx < 0) move(1);
      else move(-1);
    }
  }

  // iPhone / 触摸屏
  let touchX = 0;
  let touchY = 0;

  app.addEventListener("touchstart", (e) => {
    if (!e.touches.length) return;
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }, { passive: true });

  app.addEventListener("touchend", (e) => {
    if (!e.changedTouches.length) return;
    handleSwipe(
      e.changedTouches[0].clientX - touchX,
      e.changedTouches[0].clientY - touchY
    );
  }, { passive: true });

  // 电脑鼠标拖动 / Pointer Events
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;

  app.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") return;
    pointerDown = true;
    pointerX = e.clientX;
    pointerY = e.clientY;
    try { app.setPointerCapture(e.pointerId); } catch (_) {}
  });

  app.addEventListener("pointerup", (e) => {
    if (!pointerDown || e.pointerType === "touch") return;
    pointerDown = false;
    handleSwipe(e.clientX - pointerX, e.clientY - pointerY);
  });

  app.addEventListener("pointercancel", () => {
    pointerDown = false;
  });

  // 电脑鼠标滚轮：向下滚 = 下一项，向上滚 = 上一项。
  let wheelLocked = false;
  app.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (wheelLocked || Math.abs(e.deltaY) < 8) return;
    wheelLocked = true;
    move(e.deltaY > 0 ? 1 : -1);
    setTimeout(() => { wheelLocked = false; }, 250);
  }, { passive: false });

  // 键盘测试
  addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowRight", " ", "PageDown"].includes(e.key)) {
      e.preventDefault();
      move(1);
    } else if (["ArrowDown", "ArrowLeft", "PageUp"].includes(e.key)) {
      e.preventDefault();
      move(-1);
    }
  });

  // 从后台重新打开时，回到“现在”。
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render(true);
  });

  // 每 30 秒检查当前时间段是否变化；如果用户停留在“现在”，自动更新。
  setInterval(() => {
    if (view === 0) render(true);
  }, 30000);

  render(true);

  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
})();

(() => {
  const app = document.getElementById("app");

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

    // 00:00–03:59 仍视为前一天晚上的延续。
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
    const today = tasksForDay(now.day);
    const current = findCurrentIndex(today, now.minute);
    const timeline = [];

    // 从“现在”开始，只渲染尚未过去的内容。
    for (let i = current; i < today.length; i++) {
      timeline.push({ ...today[i], relativeDay: 0 });
    }

    // 当天看完后继续显示明天，避免凌晨或最后一项无法继续滑。
    const tomorrow = (now.day + 1) % 7;
    for (const task of tasksForDay(tomorrow)) {
      timeline.push({ ...task, relativeDay: 1 });
    }

    return timeline;
  }

  function installNativeScrollStyles() {
    // 这里直接用 JS 覆盖旧版本 CSS，因此即使 iPhone 仍缓存旧 index.html，
    // 新版 app.js 加载后也能立即恢复原生滚动。
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "auto";
    document.body.style.overscrollBehavior = "none";

    Object.assign(app.style, {
      position: "fixed",
      inset: "0",
      overflowX: "hidden",
      overflowY: "auto",
      touchAction: "pan-y",
      WebkitOverflowScrolling: "touch",
      scrollSnapType: "y mandatory",
      overscrollBehaviorY: "contain",
      background: "#f5f5f2"
    });
  }

  function makeCard(task, index) {
    const card = document.createElement("section");
    card.className = "card";

    // 不依赖旧 CSS，关键布局直接写在元素上。
    Object.assign(card.style, {
      position: "relative",
      inset: "auto",
      width: "100%",
      height: "100dvh",
      minHeight: "100dvh",
      flex: "0 0 100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "max(34px, env(safe-area-inset-top)) 28px max(38px, env(safe-area-inset-bottom))",
      textAlign: "center",
      background: "#f5f5f2",
      scrollSnapAlign: "start",
      scrollSnapStop: "always"
    });

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${window.DAY_NAMES[task.day]} · ${index === 0 ? "现在" : task.relativeDay === 0 ? "今天稍后" : "明天"} · ${displayTime(task.startText)}–${displayTime(task.endText)}`;

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = task.title;

    card.append(meta, title);

    if (task.note) {
      const note = document.createElement("div");
      note.className = "note";
      note.textContent = task.note;
      card.appendChild(note);
    }

    // 第一页给一个很轻的滑动提示；不增加按钮或菜单。
    if (index === 0) {
      const hint = document.createElement("div");
      hint.textContent = "↑ 上滑看后续";
      Object.assign(hint.style, {
        position: "absolute",
        left: "0",
        right: "0",
        bottom: "max(18px, env(safe-area-inset-bottom))",
        color: "#8a8a8a",
        fontSize: "13px",
        fontWeight: "400"
      });
      card.appendChild(hint);
    }

    return card;
  }

  function render() {
    installNativeScrollStyles();
    const timeline = buildTimeline();
    app.replaceChildren();

    if (!timeline.length) {
      const empty = document.createElement("section");
      empty.textContent = "没有安排";
      Object.assign(empty.style, {
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });
      app.appendChild(empty);
      return;
    }

    timeline.forEach((task, index) => app.appendChild(makeCard(task, index)));
    app.scrollTop = 0;
  }

  render();

  // 从后台重新打开时重新定位到“现在”。
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  // 时间跨到下一计划块后，若用户仍停留在第一页，则自动更新。
  let lastKey = "";
  setInterval(() => {
    const first = buildTimeline()[0];
    const key = first ? `${first.day}-${first.startText}-${first.title}` : "";
    if (!lastKey) lastKey = key;
    if (key !== lastKey && app.scrollTop < window.innerHeight * 0.25) {
      lastKey = key;
      render();
    }
  }, 30000);

  // 主动要求浏览器检查 service worker 更新，减少旧缓存持续时间。
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const reg = await navigator.serviceWorker.register("./sw.js");
        await reg.update();
      } catch (_) {}
    });
  }
})();

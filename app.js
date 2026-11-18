(function () {
  const data = window.QUIZ;
  const app = document.getElementById("app");
  const homeBtn = document.getElementById("home-btn");
  const scorePill = document.getElementById("score-pill");
  const STORE = "discrete-math-quiz-v1";

  const byId = new Map();
  data.topics.forEach((topic) => {
    topic.questions.forEach((q) => {
      q.topicId = topic.id;
      q.topicTitle = topic.title;
      byId.set(q.id, q);
    });
  });

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return { results: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.results !== "object") return { results: {} };
      return parsed;
    } catch (err) {
      return { results: {} };
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORE, JSON.stringify(store));
    } catch (err) {
      /* 直接打开本地文件时，个别浏览器不允许保存记录；本轮成绩仍会显示。 */
    }
  }

  let store = loadStore();
  let session = null;

  function resultOf(id) {
    return store.results[id];
  }

  function topicStats(topic) {
    let attempted = 0;
    let correct = 0;
    let wrong = 0;
    topic.questions.forEach((q) => {
      const r = resultOf(q.id);
      if (r === true) {
        attempted += 1;
        correct += 1;
      } else if (r === false) {
        attempted += 1;
        wrong += 1;
      }
    });
    return { attempted, correct, wrong, total: topic.questions.length };
  }

  function allQuestions() {
    const list = [];
    data.topics.forEach((topic) => topic.questions.forEach((q) => list.push(q)));
    return list;
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHome() {
    session = null;
    homeBtn.hidden = true;
    scorePill.hidden = true;
    const totals = allQuestions();
    let attempted = 0;
    let correct = 0;
    totals.forEach((q) => {
      const r = resultOf(q.id);
      if (r === true) {
        attempted += 1;
        correct += 1;
      } else if (r === false) attempted += 1;
    });
    const cards = data.topics.map((topic) => {
      const s = topicStats(topic);
      const wrongDisabled = s.wrong === 0 ? "disabled" : "";
      return (
        '<article class="topic-card">' +
        "<h2>" + escapeHtml(topic.title) + "</h2>" +
        '<p class="src">' + escapeHtml(topic.blurb) + " · 来源 " + escapeHtml(topic.source) + "</p>" +
        '<p class="counts">' + s.total + " 题 · 做过 " + s.attempted +
        " · 做对 " + s.correct + " · 错题 " + s.wrong + "</p>" +
        '<div class="card-actions">' +
        '<button class="btn" data-start="' + topic.id + '" data-mode="order">顺序练习</button>' +
        '<button class="btn secondary" data-start="' + topic.id + '" data-mode="shuffle">随机练习</button>' +
        '<button class="btn ghost" data-start="' + topic.id + '" data-mode="wrong" ' + wrongDisabled + ">只做错题</button>" +
        "</div></article>"
      );
    }).join("");

    app.innerHTML =
      '<p class="lead">题目都从本机课件抽出，覆盖集合、逻辑、证明、函数、关系、计数和鸽巢原理。提交后无论对错都会给出解析；选错时，解析会说明所选选项为什么不对，以及正确答案为什么对。</p>' +
      '<div class="stats-line"><span>共 ' + totals.length + " 题</span><span>做过 " + attempted +
      "</span><span>做对 " + correct + "</span></div>" +
      '<div class="hero-actions">' +
      '<button class="btn" id="random-all">全部随机</button>' +
      '<button class="btn secondary" id="clear-progress">清除练习记录</button>' +
      "</div>" +
      '<div class="topic-list">' + cards + "</div>";

    app.querySelectorAll("[data-start]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const topic = data.topics.find((t) => t.id === btn.getAttribute("data-start"));
        const mode = btn.getAttribute("data-mode");
        let queue = topic.questions.slice();
        if (mode === "shuffle") queue = shuffle(queue);
        if (mode === "wrong") queue = queue.filter((q) => resultOf(q.id) === false);
        if (!queue.length) return;
        startSession(topic.title, queue);
      });
    });
    document.getElementById("random-all").addEventListener("click", () => {
      startSession("全部随机", shuffle(allQuestions()));
    });
    document.getElementById("clear-progress").addEventListener("click", () => {
      if (window.confirm("清除这台浏览器里的做题记录？题目本身不会变。")) {
        store = { results: {} };
        saveStore(store);
        renderHome();
      }
    });
  }

  function startSession(title, queue) {
    session = {
      title: title,
      queue: queue,
      index: 0,
      correct: 0,
      answered: 0,
      missed: [],
      locked: false,
      choice: null
    };
    homeBtn.hidden = false;
    scorePill.hidden = false;
    renderQuestion();
  }

  function updatePill() {
    if (!session) {
      scorePill.hidden = true;
      return;
    }
    scorePill.hidden = false;
    scorePill.textContent = "正确 " + session.correct + " / 已答 " + session.answered;
  }

  function currentQuestion() {
    return session.queue[session.index];
  }

  function renderQuestion() {
    const q = currentQuestion();
    const n = session.queue.length;
    const pct = Math.round((session.index / n) * 100);
    updatePill();
    let body = "";
    if (q.type === "mc") {
      body = '<div class="options">' + q.options.map((opt, i) => {
        const letter = "ABCD"[i];
        return '<button type="button" class="option" data-choice="' + i + '"><span class="key">' +
          letter + ".</span> " + escapeHtml(opt) + "</button>";
      }).join("") + "</div>";
    } else if (q.type === "tf") {
      body = '<div class="tf-row">' +
        '<button type="button" class="choice" data-choice="1">正确</button>' +
        '<button type="button" class="choice" data-choice="0">错误</button>' +
        "</div>";
    } else {
      body = '<div class="fill-row"><input id="fill-input" type="text" autocomplete="off" placeholder="输入答案">' +
        '<button type="button" class="btn" id="fill-submit">提交</button></div>';
    }
    app.innerHTML =
      '<div class="progress-wrap"><div class="progress-meta"><span>' + escapeHtml(session.title) +
      "</span><span>第 " + (session.index + 1) + " / " + n + " 题</span></div>" +
      '<div class="bar"><span style="width:' + pct + '%"></span></div></div>' +
      '<article class="q-card"><p class="q-kicker">' + escapeHtml(q.topicTitle) + "</p>" +
      '<p class="stem">' + escapeHtml(q.stem) + "</p>" + body +
      '<div id="feedback"></div>' +
      '<div class="nav-row"><button type="button" class="btn ghost" id="end-btn">结束并看成绩</button>' +
      '<button type="button" class="btn" id="next-btn" hidden>下一题</button></div></article>';

    session.locked = false;
    session.choice = null;
    if (q.type === "mc" || q.type === "tf") {
      app.querySelectorAll("[data-choice]").forEach((btn) => {
        btn.addEventListener("click", () => onChoice(btn));
      });
    } else {
      const input = document.getElementById("fill-input");
      const submit = document.getElementById("fill-submit");
      submit.addEventListener("click", () => submitFill(input.value));
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") submitFill(input.value);
      });
      input.focus();
    }
    document.getElementById("end-btn").addEventListener("click", finish);
    document.getElementById("next-btn").addEventListener("click", () => {
      if (session.index + 1 >= session.queue.length) finish();
      else {
        session.index += 1;
        renderQuestion();
      }
    });
  }

  function onChoice(btn) {
    if (session.locked) return;
    const q = currentQuestion();
    const choice = Number(btn.getAttribute("data-choice"));
    session.locked = true;
    session.choice = choice;
    let ok = false;
    if (q.type === "mc") ok = choice === q.answer;
    if (q.type === "tf") ok = (choice === 1) === q.answer;
    markButtons(q, choice, ok);
    showFeedback(q, ok, choice);
    record(q, ok);
  }

  function normalize(text) {
    return String(text).trim().replace(/\s+/g, "").replace(/，/g, ",").toLowerCase();
  }

  function submitFill(value) {
    if (session.locked) return;
    const q = currentQuestion();
    if (!String(value).trim()) return;
    session.locked = true;
    const input = document.getElementById("fill-input");
    if (input) input.disabled = true;
    const got = normalize(value);
    const ok = (q.accept || []).some((item) => normalize(item) === got);
    showFeedback(q, ok, value);
    record(q, ok);
  }

  function markButtons(q, choice, ok) {
    app.querySelectorAll("[data-choice]").forEach((btn) => {
      const value = Number(btn.getAttribute("data-choice"));
      btn.disabled = true;
      if (q.type === "mc" && value === q.answer) btn.classList.add("good");
      if (q.type === "tf" && ((value === 1) === q.answer)) btn.classList.add("good");
      if (value === choice && !ok) btn.classList.add("bad");
    });
  }

  function chosenLabel(q, choice) {
    if (q.type === "mc") return "ABCD"[choice] + ". " + q.options[choice];
    if (q.type === "tf") return choice === 1 ? "正确" : "错误";
    return String(choice);
  }

  function showFeedback(q, ok, choice) {
    const box = document.getElementById("feedback");
    box.className = "feedback " + (ok ? "good" : "bad");
    const head = ok ? "回答正确" : "回答错误";
    let extra = "";
    if (!ok) {
      extra = "你的选择：" + chosenLabel(q, choice) + "。\n";
    } else if (q.type === "fill") {
      extra = "你的答案：" + String(choice).trim() + "。\n";
    }
    box.innerHTML = "<h3>" + head + "</h3><p>" + escapeHtml(extra + q.explain) + "</p>";
    const next = document.getElementById("next-btn");
    next.hidden = false;
    next.textContent = session.index + 1 >= session.queue.length ? "查看成绩" : "下一题";
    updatePill();
  }

  function record(q, ok) {
    session.answered += 1;
    if (ok) session.correct += 1;
    else session.missed.push(q.id);
    store.results[q.id] = ok;
    saveStore(store);
  }

  function finish() {
    if (!session) return renderHome();
    const answered = session.answered;
    const correct = session.correct;
    const title = session.title;
    const missedIds = session.missed.slice();
    const rate = answered ? Math.round((correct / answered) * 100) : 0;
    homeBtn.hidden = false;
    scorePill.hidden = true;
    const redoWrong = missedIds.length
      ? '<button class="btn" id="redo-wrong">只做错题（' + missedIds.length + "）</button>"
      : "";
    app.innerHTML =
      '<article class="end-card panel"><h2>' + escapeHtml(title) + " 成绩</h2>" +
      '<p class="big-score">' + correct + " / " + answered + "</p>" +
      "<p>正确率 " + rate + "%。本轮答错 " + missedIds.length + " 题。解析在每题提交后都已给出。</p>" +
      '<div class="end-actions">' + redoWrong +
      '<button class="btn secondary" id="back-home">返回目录</button></div></article>';
    const wrongBtn = document.getElementById("redo-wrong");
    if (wrongBtn) {
      wrongBtn.addEventListener("click", () => {
        const queue = missedIds.map((id) => byId.get(id)).filter(Boolean);
        startSession(title + " · 错题", queue);
      });
    }
    document.getElementById("back-home").addEventListener("click", renderHome);
    session = null;
  }

  homeBtn.addEventListener("click", () => {
    if (session && session.answered > 0 && session.index < session.queue.length) {
      if (!window.confirm("离开后，这一轮未答的题不会记入成绩。已提交的题会保留。")) return;
    }
    renderHome();
  });

  renderHome();
})();

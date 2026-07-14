const dateOptions = [
  "7月14日（周二）",
  "7月15日（周三）",
  "7月16日（周四）",
  "7月17日（周五）",
  "7月18日（周六）",
  "7月19日（周日）",
  "7月20日（周一）",
  "7月21日（周二）"
];

const cuisineOptions = [
  "烤肉",
  "日料",
  "自助",
  "西餐",
  "粤菜",
  "豫菜",
  "鲁菜",
  "云南菜",
  "东北菜",
  "淮扬菜",
  "湘菜",
  "川菜",
  "火锅",
  "小龙虾",
  "其它"
];

const STORAGE_KEY = "meal_flow_records_v1";
const CLOUD_ENV_ID = "torenwang-d2gbekikab13dfdaa";
const CLOUD_FUNCTION_NAME = "saveMealRecord";


const questionStage = document.getElementById("questionStage");
const flowForm = document.getElementById("flowForm");
const flowSection = document.getElementById("flowSection");
const welcome = document.getElementById("welcome");
const startBtn = document.getElementById("startBtn");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const submitBtn = document.getElementById("submitBtn");
const tipText = document.getElementById("tipText");
const resultSection = document.getElementById("resultSection");
const resultText = document.getElementById("resultText");
const confirmBtn = document.getElementById("confirmBtn");
const restartBtn = document.getElementById("restartBtn");
const recordPanel = document.getElementById("recordPanel");
const recordList = document.getElementById("recordList");
const bgm = document.getElementById("bgm");
const musicToggle = document.getElementById("musicToggle");
const musicVolume = document.getElementById("musicVolume");

const cloudApp = window.cloudbase ? window.cloudbase.init({ env: CLOUD_ENV_ID }) : null;
let cloudReady = false;


const state = {
  returnDate: "",
  arrivalSlot: "",
  mealType: "",
  cuisines: [],
  otherCuisine: "",
  pickup: "",
  area: "",
  diet: "",
  remark: ""
};

let records = [];
let stepIndex = 0;
let pendingResult = "";
let confirmedResult = "";

function makeSlots() {
  const slots = [];
  for (let i = 0; i < 48; i += 1) {
    const start = i * 30;
    const end = (i + 1) * 30;
    const startHour = String(Math.floor(start / 60)).padStart(2, "0");
    const startMin = String(start % 60).padStart(2, "0");
    const endHour = String(Math.floor((end % 1440) / 60)).padStart(2, "0");
    const endMin = String((end % 1440) % 60).padStart(2, "0");
    slots.push(`${startHour}:${startMin} - ${endHour}:${endMin}`);
  }
  return slots;
}

const timeSlots = makeSlots();

const questions = [
  {
    key: "returnDate",
    title: "你预计哪天回北京呀？",
    desc: "",
    type: "radio",
    className: "two",
    options: dateOptions,
    validate: (v) => Boolean(v),
    tip: "请先选一个返京日期～"
  },
  {
    key: "arrivalSlot",
    title: "大概几点到南站呢",
    desc: "这里是每半小时一个时间段，选最接近的就可以。",
    type: "select",
    validate: (v) => Boolean(v),
    tip: "请先选一个到站时间段～"
  },
  {
    key: "mealType",
    title: "更想午饭还是晚饭？",
    desc: "",
    type: "radio",
    className: "two",
    options: [
      { value: "午饭", label: "午饭 ☀️" },
      { value: "晚饭", label: "晚饭 🌙" }
    ],
    validate: (v) => Boolean(v),
    tip: "请先选午饭或晚饭～"
  },
  {
    key: "cuisines",
    title: "想吃什么菜系呢？（可多选）",
    desc: "",
    type: "checkbox",
    className: "three",
    options: cuisineOptions,
    validate: () => {
      if (state.cuisines.length === 0) {
        return false;
      }
      if (state.cuisines.includes("其它") && !state.otherCuisine.trim()) {
        return false;
      }
      return true;
    },
    tip: "至少选一种菜系；若选“其它”请补充具体类型～"
  },
  {
    key: "pickup",
    title: "我可以去接站嘛（期待你说可以！）",
    desc: "",
    type: "radio",
    className: "three",
    options: [
      { value: "可以", label: "可以😊" },
      { value: "不可以", label: "不可以 😭" },
      { value: "有空的话就可以", label: "有空的话就可以 😆" }
    ],
    validate: (v) => Boolean(v),
    tip: "这题也帮我选一下～"
  },
  {
    key: "plus",
    title: "最后确认一点点细节~",
    desc: "",
    type: "group",
    validate: () => true,
    tip: "可以直接下一步。"
  },
  {
    key: "remark",
    title: "还有什么想告诉我的吗？（可选）",
    desc: "比如想要安静一点、近地铁等。",
    type: "textarea",
    validate: () => true,
    tip: "写完就可以生成饭局卡片啦。"
  }
];

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cuisineLabel(item) {
  if (item === "豫菜") {
    return `${item}<span class="tag">有很好吃的菜馆，重点推荐！</span>`;
  }
  return item;
}

function normalizeRadioOption(item) {
  if (typeof item === "string") {
    return { value: item, label: item };
  }
  return item;
}

function renderQuestion() {
  const q = questions[stepIndex];
  const current = state[q.key];

  let body = "";

  if (q.type === "radio") {
    body = `
      <div class="options-grid ${q.className || ""}">
        ${q.options
          .map((rawItem) => {
            const item = normalizeRadioOption(rawItem);
            return `
              <label class="option-card">
                <input type="radio" name="${q.key}" value="${escapeHtml(item.value)}" ${current === item.value ? "checked" : ""} />
                <span>${escapeHtml(item.label)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    `;
  }

  if (q.type === "checkbox") {
    const showOtherInput = state.cuisines.includes("其它");
    body = `
      <div class="options-grid ${q.className || ""}">
        ${q.options
          .map((item) => {
            const checked = state.cuisines.includes(item);
            return `
              <label class="option-card">
                <input type="checkbox" name="cuisines" value="${escapeHtml(item)}" ${checked ? "checked" : ""} />
                <span>${cuisineLabel(item)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
      ${
        showOtherInput
          ? `<input id="otherCuisineInput" class="other-cuisine-input" type="text" placeholder="其它的话，想吃什么可以写在这里" value="${escapeHtml(state.otherCuisine)}" />`
          : ""
      }
    `;
  }

  if (q.type === "select") {
    body = `
      <select id="arrivalSlotSelect" class="time-wheel" size="8">
        ${timeSlots
          .map((slot) => `<option value="${slot}" ${slot === state.arrivalSlot ? "selected" : ""}>${slot}</option>`)
          .join("")}
      </select>
    `;
  }

  if (q.type === "group") {
    body = `
      <div class="options-grid two">
        <label>
          <span>区域范围（可选）</span>
          <input id="areaInput" type="text" placeholder="比如：国贸 / 西单 / 三里屯" value="${escapeHtml(state.area)}" />
        </label>
        <label>
          <span>忌口/过敏（可选）</span>
          <input id="dietInput" type="text" placeholder="比如：海鲜过敏 / 不吃香菜" value="${escapeHtml(state.diet)}" />
        </label>
      </div>
    `;
  }

  if (q.type === "textarea") {
    body = `
      <textarea id="remarkInput" placeholder="比如：想找安静一点、离地铁近">${escapeHtml(state.remark)}</textarea>
    `;
  }

  questionStage.innerHTML = `
    <h2 class="question-title">${q.title}</h2>
    ${q.desc ? `<p class="question-desc">${q.desc}</p>` : ""}
    ${body}
  `;

  progressText.textContent = `第 ${stepIndex + 1} / ${questions.length} 步`;
  progressBar.style.width = `${((stepIndex + 1) / questions.length) * 100}%`;

  prevBtn.disabled = stepIndex === 0;
  const isLast = stepIndex === questions.length - 1;
  nextBtn.classList.toggle("hidden", isLast);
  submitBtn.classList.toggle("hidden", !isLast);

  tipText.textContent = "";

  bindCurrentQuestionEvents(q);
}

function bindCurrentQuestionEvents(q) {
  if (q.type === "radio") {
    questionStage.querySelectorAll(`input[name="${q.key}"]`).forEach((el) => {
      el.addEventListener("change", () => {
        state[q.key] = el.value;
      });
    });
  }

  if (q.type === "checkbox") {
    questionStage.querySelectorAll('input[name="cuisines"]').forEach((el) => {
      el.addEventListener("change", () => {
        const selected = [...questionStage.querySelectorAll('input[name="cuisines"]:checked')].map((node) => node.value);
        state.cuisines = selected;
        if (!selected.includes("其它")) {
          state.otherCuisine = "";
        }
        renderQuestion();
      });
    });

    const otherCuisineInput = document.getElementById("otherCuisineInput");
    if (otherCuisineInput) {
      otherCuisineInput.addEventListener("input", () => {
        state.otherCuisine = otherCuisineInput.value.trim();
      });
    }
  }

  if (q.type === "select") {
    const select = document.getElementById("arrivalSlotSelect");
    if (!state.arrivalSlot) {
      state.arrivalSlot = select.value;
    }
    select.addEventListener("change", () => {
      state.arrivalSlot = select.value;
    });
  }

  if (q.type === "group") {
    const areaInput = document.getElementById("areaInput");
    const dietInput = document.getElementById("dietInput");

    areaInput.addEventListener("input", () => {
      state.area = areaInput.value.trim();
    });
    dietInput.addEventListener("input", () => {
      state.diet = dietInput.value.trim();
    });
  }

  if (q.type === "textarea") {
    const remarkInput = document.getElementById("remarkInput");
    remarkInput.addEventListener("input", () => {
      state.remark = remarkInput.value.trim();
    });
  }
}

function validateCurrent() {
  const q = questions[stepIndex];
  const valid = q.validate(state[q.key]);
  if (!valid) {
    tipText.textContent = q.tip;
  } else {
    tipText.textContent = "";
  }
  return valid;
}

function nextStep() {
  if (!validateCurrent()) {
    return;
  }
  if (stepIndex < questions.length - 1) {
    stepIndex += 1;
    renderQuestion();
  }
}

function prevStep() {
  if (stepIndex > 0) {
    stepIndex -= 1;
    renderQuestion();
  }
}

function buildResult() {
  const cuisineList = [...state.cuisines.filter((item) => item !== "其它")];
  if (state.cuisines.includes("其它") && state.otherCuisine) {
    cuisineList.push(`其它（${state.otherCuisine}）`);
  }
  const cuisines = cuisineList.length > 0 ? cuisineList.join("、") : "待定";

  const lines = [
    "📮 师姐返京欢迎饭局卡片",
    "",
    `- 回京日期：${state.returnDate}`,
    `- 到站时间段：${state.arrivalSlot}`,
    `- 更想吃：${state.mealType}`,
    `- 菜系偏好：${cuisines}`,
    `- 接站安排：${state.pickup}`,
    `- 区域范围：${state.area || "未指定"}`,
    `- 忌口信息：${state.diet || "无"}`,
    `- 其他备注：${state.remark || "无"}`
  ];

  return lines.join("\n");
}

function buildCloudPayload(content) {
  return {
    returnDate: state.returnDate,
    arrivalSlot: state.arrivalSlot,
    mealType: state.mealType,
    cuisines: [...state.cuisines],
    otherCuisine: state.otherCuisine,
    pickup: state.pickup,
    area: state.area,
    diet: state.diet,
    remark: state.remark,
    cardText: content
  };
}

async function initCloud() {
  if (!cloudApp) {
    return;
  }

  try {
    const auth = cloudApp.auth({ persistence: "local" });
    if (typeof auth.signInAnonymously === "function") {
      await auth.signInAnonymously();
    } else {
      await auth.anonymousAuthProvider().signIn();
    }
    cloudReady = true;
  } catch (error) {
    cloudReady = false;
    console.warn("CloudBase 初始化失败", error);
  }
}

async function saveRecordToCloud(content) {
  if (!cloudReady || !cloudApp) {
    return;
  }

  try {
    await cloudApp.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data: {
        payload: buildCloudPayload(content)
      }
    });
  } catch (error) {
    console.warn("云端保存失败", error);
  }
}

function loadRecords() {

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    records = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(records)) {
      records = [];
    }
  } catch {
    records = [];
  }
  renderRecords();
}

function saveRecord(content) {
  const item = {
    id: Date.now(),
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    content
  };
  records.unshift(item);
  records = records.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  renderRecords();
}

function renderRecords() {
  if (!recordPanel || !recordList) {
    return;
  }

  if (records.length === 0) {
    recordPanel.classList.add("hidden");
    recordList.innerHTML = "";
    return;
  }

  recordPanel.classList.remove("hidden");
  recordList.innerHTML = records
    .map(
      (item) => `
      <li>
        <p class="record-time">${escapeHtml(item.createdAt)}</p>
        <pre>${escapeHtml(item.content)}</pre>
      </li>
    `
    )
    .join("");
}

function resetFlow() {
  state.returnDate = "";
  state.arrivalSlot = timeSlots[32];
  state.mealType = "";
  state.cuisines = [];
  state.otherCuisine = "";
  state.pickup = "";
  state.area = "";
  state.diet = "";
  state.remark = "";

  pendingResult = "";
  confirmedResult = "";
  stepIndex = 0;
  renderQuestion();
  resultSection.classList.add("hidden");
}

function bindFlowEvents() {
  startBtn.addEventListener("click", () => {
    welcome.classList.add("hidden");
    flowSection.classList.remove("hidden");
    flowSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  nextBtn.addEventListener("click", nextStep);
  prevBtn.addEventListener("click", prevStep);

  flowForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateCurrent()) {
      return;
    }
    const content = buildResult();
    pendingResult = content;
    confirmedResult = "";
    resultText.textContent = content;
    if (confirmBtn) {
      confirmBtn.textContent = "确认";
    }
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  if (confirmBtn) {
    confirmBtn.textContent = "确认";
    confirmBtn.addEventListener("click", async () => {
      if (!pendingResult) {
        return;
      }
      if (pendingResult !== confirmedResult) {
        saveRecord(pendingResult);
        await saveRecordToCloud(pendingResult);
        confirmedResult = pendingResult;
      }
      confirmBtn.textContent = "已确认 ✅";
      setTimeout(() => {
        confirmBtn.textContent = "确认";
      }, 1200);
    });
  }


  restartBtn.addEventListener("click", () => {
    resultSection.classList.add("hidden");
    welcome.classList.remove("hidden");
    flowSection.classList.add("hidden");
    resetFlow();
    welcome.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function tryPlayWithFallback() {
  const tried = new Set();
  const candidates = [bgm.src, ...BGM_SOURCES].filter(Boolean);

  for (const src of candidates) {
    if (tried.has(src)) {
      continue;
    }
    tried.add(src);

    try {
      if (bgm.src !== src) {
        bgm.src = src;
      }
      bgm.load();
      await bgm.play();
      return true;
    } catch (error) {
      console.warn("音源尝试失败", src, error);
    }
  }

  return false;
}

function bindMusicEvents() {
  bgm.volume = Number(musicVolume.value);

  musicVolume.addEventListener("input", () => {
    bgm.volume = Number(musicVolume.value);
  });

  musicToggle.addEventListener("click", async () => {
    if (!bgm.paused) {
      bgm.pause();
      musicToggle.textContent = "🎵 开启BGM";
      return;
    }

    musicToggle.disabled = true;
    musicToggle.textContent = "🎵 正在播放...";

    const ok = await tryPlayWithFallback();
    musicToggle.textContent = ok ? "⏸ 暂停BGM" : "🎵 播放失败，点我重试";
    musicToggle.disabled = false;
  });
}



function init() {
  resetFlow();
  bindFlowEvents();
  bindMusicEvents();
  initCloud();
}



init();

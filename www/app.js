// Robot 2027 V2.3 - Main Application Controller
const MODEL_PRESETS = {
  smollm2_q4_0: {
    id: "SMOLLM2-Q4_0",
    fileName: "SmolLM2-135M-Instruct-Q4_0.gguf",
    url: "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_0.gguf?download=true",
    sizeLabel: "85 MB"
  },
  smollm2_iq3_xs: {
    id: "SMOLLM2-IQ3",
    fileName: "SmolLM2-135M-Instruct-IQ3_XS.gguf",
    url: "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-IQ3_XS.gguf?download=true",
    sizeLabel: "68 MB"
  },
  smollm2_q4_k_m: {
    id: "SMOLLM2-Q4KM",
    fileName: "SmolLM2-135M-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf?download=true",
    sizeLabel: "105 MB"
  },
  smollm1_q4_0: {
    id: "SMOLLM1-Q4_0",
    fileName: "SmolLM-135M-Instruct-Q4_0.gguf",
    url: "https://huggingface.co/bartowski/SmolLM-135M-Instruct-GGUF/resolve/main/SmolLM-135M-Instruct-Q4_0.gguf?download=true",
    sizeLabel: "82 MB"
  },
  qwen25_05b: {
    id: "QWEN2.5-0.5B",
    fileName: "Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf?download=true",
    sizeLabel: "398 MB"
  }
};

const PERSONA_PROMPTS = {
  ENGLISH_TEACHER: "You are Robo, a warm bilingual English teacher for kids. Reply in 1 short simple English sentence (max 14 words) and encourage speaking.",
  FRIEND_BUDDY: "You are Robo, a playful best friend. Reply in 1 fun short English sentence (max 14 words).",
  FAMILY_MANAGER: "You are Robo, a smart family helper. Reply warmly in 1 clear English sentence (max 15 words).",
  STORY_TELLER: "You are Robo, an imaginative storyteller. Reply in 1 exciting short English sentence (max 15 words).",
  HAPPY_CHEF: "You are Robo, a cheerful chef buddy. Reply in 1 fun English sentence about yummy food (max 14 words).",
  HEALTH_CARE: "You are Robo, a caring health buddy. Reply gently in 1 simple English sentence (max 14 words)."
};

const CapacitorPlugins = (window.Capacitor && window.Capacitor.Plugins) ? window.Capacitor.Plugins : {};
const LlamaLocal = CapacitorPlugins.LlamaLocal || null;
const SpeechBridge = CapacitorPlugins.SpeechBridge || null;

let apiChatUrl = localStorage.getItem("robot2027_api_url") || "https://khotrithucso.io.vn/robot2027_2/api_chat.php";
let isListening = false;
let currentAnim = "IDLE_ALIVE";
let currentSuggestions = [
  "Hello Robo!",
  "Let us play hide and seek",
  "Tell me about my mom",
  "What did Bi learn today?"
];

window.__robotBusy = false;

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("apiUrlInput").value = apiChatUrl;
  syncModelPresetInput();
  document.getElementById("modelSelect").addEventListener("change", syncModelPresetInput);

  refreshFamilyUI();
  renderQuickChips(currentSuggestions);
  startBlinkLoop();
  setupNativeListeners();
  checkNativeModelStatus();

  // Khởi động bộ não chủ động 3 mốc thời gian
  ProactiveEngine.init({
    onTrigger: handleProactiveEvent,
    onTick: (sec, isOn) => {
      const bar = document.getElementById("proactiveHintBar");
      if (!isOn) {
        bar.textContent = "⏸️ Chế độ chủ động đang tắt";
      } else if (sec === 0) {
        bar.textContent = "✨ Sẵn sàng trò chuyện qua lại";
      } else if (sec < 8) {
        bar.textContent = `⏳ Chờ bạn trả lời (${sec}s / 8s gợi ý dịch)...`;
      } else if (sec < 19) {
        bar.textContent = `💡 Đã giải thích nghĩa (${sec}s / 19s đổi chủ đề)...`;
      } else {
        bar.textContent = "💬 Đang duy trì kết nối chủ động";
      }
    }
  });
  updateProactiveBadge();

  // Lời chào mở đầu theo ngữ cảnh thành viên hiện tại
  const active = MemoryEngine.getActiveMember();
  const prevHistory = MemoryEngine.getMemberHistory(active.name, 2);

  if (prevHistory.length > 0) {
    const lastTopic = prevHistory[prevHistory.length - 1].topic || "English";
    deliverMultiBubbleReply([
      {
        en: `Welcome back, ${active.name}! Good to see you again.`,
        vi: `Chào mừng ${active.name} đã quay lại! Rất vui được gặp lại bạn.`,
        anim: "HAPPY_EXCITED"
      },
      {
        en: `Earlier we talked about ${lastTopic}. What shall we talk about now?`,
        vi: `Lúc trước chúng ta đã nói về chủ đề ${lastTopic}. Bây giờ mình nói chuyện gì tiếp nào?`,
        anim: "CURIOUS_TILT"
      }
    ], "Hệ thống • Khôi phục ngữ cảnh");
  } else {
    deliverMultiBubbleReply([
      {
        en: `Hello ${active.name}! I am Robot 2027, your English buddy.`,
        vi: `Xin chào ${active.name}! Mình là Robot 2027, người bạn đồng hành học tiếng Anh của bạn.`,
        anim: "HAPPY_EXCITED"
      },
      {
        en: `How are you today? You can tap the mic or choose a sentence below!`,
        vi: `Hôm nay bạn thế nào? Bạn có thể bấm micro để nói hoặc chọn câu gợi ý bên dưới nhé!`,
        anim: "PLAYFUL_WINK"
      }
    ], "Bot chủ động chào & mở đầu hội thoại");
  }
});

function setupNativeListeners() {
  if (LlamaLocal && LlamaLocal.addListener) {
    LlamaLocal.addListener("downloadProgress", (ev) => {
      const fill = document.getElementById("modelProgressFill");
      const txt = document.getElementById("modelStatusText");
      if (ev.stage === "loading_ram") {
        fill.style.width = "100%";
        txt.textContent = "⚙️ Đang nạp model vào RAM Android...";
      } else {
        const pct = ev.percent || 0;
        fill.style.width = pct + "%";
        const mb = ((ev.downloaded || 0) / (1024 * 1024)).toFixed(1);
        txt.textContent = `⬇️ Đang tải model: ${pct}% (${mb} MB)...`;
      }
    });
  }

  if (SpeechBridge && SpeechBridge.addListener) {
    SpeechBridge.addListener("sttEvent", (ev) => {
      const micBtn = document.getElementById("micBtn");
      const inputEl = document.getElementById("chatInput");

      if (ev.status === "ready" || ev.status === "speaking") {
        isListening = true;
        window.__robotBusy = true;
        micBtn.classList.add("listening");
        setRobotExpression("LISTENING_ATTENTIVE");
      } else if (ev.status === "partial") {
        inputEl.value = ev.text || "";
      } else if (ev.status === "final") {
        isListening = false;
        window.__robotBusy = false;
        micBtn.classList.remove("listening");
        const spoken = (ev.text || "").trim();
        if (spoken) {
          inputEl.value = spoken;
          handleUserSend();
        } else {
          setRobotExpression("IDLE_ALIVE");
        }
      } else if (ev.status === "error") {
        isListening = false;
        window.__robotBusy = false;
        micBtn.classList.remove("listening");
        setRobotExpression("CURIOUS_TILT");
        const active = MemoryEngine.getActiveMember();
        appendSystemNotice(
          `🎤 Chưa nghe rõ câu tiếng Anh (mã ${ev.code}). ${active.name} hãy nói chậm hơn hoặc bấm câu gợi ý bên dưới nhé!`
        );
      }
    });

    SpeechBridge.addListener("ttsState", (ev) => {
      if (ev.state === "start") {
        setMouthSpeaking(true);
      } else if (ev.state === "done") {
        setMouthSpeaking(false);
      }
    });
  }
}

async function checkNativeModelStatus() {
  if (!LlamaLocal) return;
  try {
    const st = await LlamaLocal.getStatus();
    if (st && st.loaded) {
      setAiBadge(true, st.modelId || "SMOLLM2");
    }
  } catch (e) {}
}

// ==================== DRAWERS & SETTINGS ====================
function toggleDrawer(id) {
  const target = document.getElementById(id);
  const willOpen = !target.classList.contains("open");
  document.querySelectorAll(".drawer").forEach(d => d.classList.remove("open"));
  if (willOpen) target.classList.add("open");
}

function syncModelPresetInput() {
  const key = document.getElementById("modelSelect").value;
  const preset = MODEL_PRESETS[key];
  if (preset) {
    document.getElementById("modelUrlInput").value = preset.url;
  }
}

function setAiBadge(ok, label) {
  const badge = document.getElementById("aiBadge");
  if (ok) {
    badge.className = "pill pill-ai-ok";
    badge.textContent = "✅ " + label;
  } else {
    badge.className = "pill pill-ai-err";
    badge.textContent = "❌ " + label;
  }
}

async function downloadAndActivateModel() {
  const key = document.getElementById("modelSelect").value;
  const preset = MODEL_PRESETS[key] || MODEL_PRESETS.smollm2_q4_0;
  const customUrl = document.getElementById("modelUrlInput").value.trim() || preset.url;
  const txt = document.getElementById("modelStatusText");

  if (!LlamaLocal) {
    txt.textContent = "⚠️ Chạy trên trình duyệt Web: chế độ mô phỏng. Hãy cài APK trên Android để chạy llama.cpp thật!";
    setAiBadge(true, preset.id + " (WEB)");
    return;
  }

  txt.textContent = `⏳ Bắt đầu tải ${preset.fileName} (${preset.sizeLabel})...`;
  try {
    const res = await LlamaLocal.downloadAndLoad({
      url: customUrl,
      fileName: preset.fileName,
      modelId: preset.id,
      threads: 4
    });
    setAiBadge(true, res.modelId || preset.id);
    txt.textContent = `✅ Đã nạp thành công ${res.modelId} (${res.sizeMB} MB) — Tốc độ cao ARM!`;
  } catch (err) {
    setAiBadge(false, "Lỗi tải AI");
    txt.textContent = "❌ " + (err.message || err);
  }
}

async function clearLocalModels() {
  if (LlamaLocal) {
    await LlamaLocal.deleteModels();
  }
  document.getElementById("modelProgressFill").style.width = "0%";
  document.getElementById("modelStatusText").textContent = "🧹 Đã xóa bộ nhớ model cũ.";
  setAiBadge(false, "Chưa nạp AI");
}

function setPresetApi(url) {
  document.getElementById("apiUrlInput").value = url;
}

function saveServerConfig() {
  apiChatUrl = document.getElementById("apiUrlInput").value.trim();
  localStorage.setItem("robot2027_api_url", apiChatUrl);
  toggleDrawer("serverDrawer");
  appendSystemNotice("✅ Đã lưu địa chỉ Server: " + apiChatUrl);
}

function toggleProactiveMode() {
  const next = !ProactiveEngine.isEnabled();
  ProactiveEngine.setEnabled(next);
  updateProactiveBadge();
  if (next) {
    ProactiveEngine.start();
  }
}

function updateProactiveBadge() {
  const badge = document.getElementById("proactiveBadge");
  if (ProactiveEngine.isEnabled()) {
    badge.className = "pill pill-proactive-on";
    badge.textContent = "🤖 Chủ động: BẬT";
  } else {
    badge.className = "pill pill-proactive-off";
    badge.textContent = "⏸️ Chủ động: TẮT";
  }
}

// ==================== FAMILY & CONTEXT MEMORY ====================
function refreshFamilyUI() {
  const members = MemoryEngine.loadMembers();
  const active = MemoryEngine.getActiveMember();

  document.getElementById("activeMemberPill").textContent = `👤 ${active.name} (${active.age}t)`;
  document.getElementById("personaSelect").value = active.persona || "ENGLISH_TEACHER";

  const sel = document.getElementById("memberSelect");
  sel.innerHTML = "";
  members.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.age}t)`;
    if (m.id === active.id) opt.selected = true;
    sel.appendChild(opt);
  });

  const listBox = document.getElementById("familyList");
  listBox.innerHTML = "";
  members.forEach(m => {
    const logs = MemoryEngine.getMemberHistory(m.name, 50);
    const card = document.createElement("div");
    card.className = "family-card";
    card.innerHTML = `
      <div>
        <b>👤 ${m.name}</b> (${m.age} tuổi • ${m.role === "PARENT" ? "Phụ huynh" : "Bé học"})<br/>
        <span style="color:#94a3b8; font-size:11px;">Đã lưu ${logs.length} lượt hội thoại</span>
      </div>
      <div style="display:flex; gap:5px;">
        <button class="mini-tool-btn" onclick="switchToMember('${m.id}')">Chọn</button>
        <button class="mini-tool-btn" style="color:#fca5a5;" onclick="removeMemberUI('${m.id}')">Xóa</button>
      </div>
    `;
    listBox.appendChild(card);
  });
}

function switchToMember(id) {
  MemoryEngine.setActiveMemberId(id);
  refreshFamilyUI();
  toggleDrawer("familyDrawer");
  const active = MemoryEngine.getActiveMember();
  ProactiveEngine.resetTimer();

  const hist = MemoryEngine.getMemberHistory(active.name, 2);
  if (hist.length > 0) {
    deliverMultiBubbleReply([
      {
        en: `Hi ${active.name}! Now I am talking with you.`,
        vi: `Chào ${active.name}! Bây giờ mình đang trò chuyện cùng bạn nhé.`,
        anim: "HAPPY_EXCITED"
      },
      {
        en: `Last time we chatted about ${hist[hist.length - 1].topic}. Want to continue?`,
        vi: `Lần trước mình nói về chủ đề ${hist[hist.length - 1].topic}. Bạn muốn tiếp tục không?`,
        anim: "CURIOUS_TILT"
      }
    ], "Chuyển thành viên • Giữ mạch ngữ cảnh");
  } else {
    deliverMultiBubbleReply([
      {
        en: `Hello ${active.name}! Nice to talk with you. What do you want to learn today?`,
        vi: `Xin chào ${active.name}! Rất vui được nói chuyện với bạn. Hôm nay bạn muốn học gì nào?`,
        anim: "LOVE_WARM"
      }
    ], "Chuyển thành viên mới");
  }
}

function onMemberSelectChange() {
  const id = document.getElementById("memberSelect").value;
  MemoryEngine.setActiveMemberId(id);
  refreshFamilyUI();
  const active = MemoryEngine.getActiveMember();
  appendSystemNotice(`👤 Đã chuyển người đang nói sang: ${active.name} (${active.age}t)`);
}

function onPersonaChange() {
  const active = MemoryEngine.getActiveMember();
  const persona = document.getElementById("personaSelect").value;
  MemoryEngine.upsertMember(active.name, active.age, active.role, persona);
}

function addFamilyMemberUI() {
  const name = document.getElementById("newMemberName").value.trim();
  const age = parseInt(document.getElementById("newMemberAge").value, 10) || 6;
  if (!name) return;
  const saved = MemoryEngine.upsertMember(name, age);
  if (!saved) {
    appendSystemNotice("⚠️ Tên không hợp lệ, hãy nhập tên thật (VD: Bi, Na, Mom, Dad).");
    return;
  }
  document.getElementById("newMemberName").value = "";
  refreshFamilyUI();
  toggleDrawer("familyDrawer");
  deliverMultiBubbleReply([
    {
      en: `Welcome ${saved.name}! I saved you in our family memory.`,
      vi: `Chào mừng ${saved.name}! Mình đã lưu bạn vào bộ nhớ gia đình rồi nhé.`,
      anim: "HAPPY_EXCITED"
    }
  ], "Đã ghi nhớ thành viên gia đình");
}

function removeMemberUI(id) {
  MemoryEngine.deleteMember(id);
  refreshFamilyUI();
}

function askBotForNewUser() {
  toggleDrawer("familyDrawer");
  deliverMultiBubbleReply([
    {
      en: "Hello! Who is talking to me right now? What is your name?",
      vi: "Xin chào! Ai đang nói chuyện với mình vậy? Bạn tên là gì?",
      anim: "CURIOUS_TILT"
    }
  ], "Bot chủ động hỏi danh tính");
}

function showChildReportInChat() {
  toggleDrawer("familyDrawer");
  const report = MemoryEngine.buildParentReportForChild("Bi");
  deliverMultiBubbleReply([
    {
      en: report.enBubbles[0],
      vi: report.viSummary,
      anim: "LOVE_WARM"
    },
    {
      en: report.enBubbles[1],
      vi: "Bạn có thể hỏi thêm: 'What did Bi learn today?' bất cứ lúc nào!",
      anim: "HAPPY_EXCITED"
    }
  ], "📊 Báo cáo Lịch sử Học tập Gia đình");
}

// ==================== PROACTIVE & BILINGUAL RESCUE HANDLER ====================
async function handleProactiveEvent(event) {
  if (window.__robotBusy) return;
  const active = MemoryEngine.getActiveMember();

  if (event.stage === 1 && event.lastBotSentence) {
    // Tự động dịch câu vừa nói sang tiếng Việt và hướng dẫn người dùng trả lời
    const tr = await BilingualEngine.translateToVietnamese(event.lastBotSentence);
    const vocabNote = tr.vocab.length > 0
      ? " • Từ vựng: " + tr.vocab.map(v => `${v.w} = ${v.vi}`).join(", ")
      : "";

    const rescueVi = `Ồ, ${active.name} chưa hiểu câu này à? Câu vừa rồi nghĩa là: "${tr.vi}"${vocabNote}. Bạn thử bấm nút gợi ý bên dưới để trả lời nhé!`;

    deliverMultiBubbleReply([
      {
        en: `Don't worry, ${active.name}! Let me explain that in Vietnamese for you.`,
        vi: rescueVi,
        speakViAfter: true,
        anim: "LOVE_WARM"
      }
    ], "🇻🇳 Trợ giảng Song ngữ Chủ động");
  } else if (event.stage === 2 && event.topic) {
    renderQuickChips([event.topic.hint, "Tell me more!", "Let's play a game", "Translate please"]);
    deliverMultiBubbleReply([
      {
        en: event.topic.en,
        vi: event.topic.vi,
        anim: event.topic.anim || "PLAYFUL_WINK"
      }
    ], "💡 Chủ động gợi mở chủ đề liền mạch");
  }
}

// ==================== MAIN CONVERSATION PIPELINE ====================
async function handleUserSend() {
  const inputEl = document.getElementById("chatInput");
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";
  ProactiveEngine.resetTimer();

  const active = MemoryEngine.getActiveMember();
  appendChatBubble("user", text, active.name);
  MemoryEngine.appendChatLog(active.name, "user", text, "chat");

  // 1. Kiểm tra xem người dùng có đang giới thiệu tên/tuổi mới không
  const intro = MemoryEngine.extractNameAndAge(text);
  if (intro.name && intro.name.toLowerCase() !== active.name.toLowerCase()) {
    const saved = MemoryEngine.upsertMember(intro.name, intro.age || 6);
    if (saved) {
      refreshFamilyUI();
      deliverMultiBubbleReply([
        {
          en: `Nice to meet you, ${saved.name}! I saved you in my family memory.`,
          vi: `Rất vui được gặp ${saved.name}! Mình đã ghi nhớ bạn vào danh sách gia đình rồi.`,
          anim: "HAPPY_EXCITED"
        },
        {
          en: `How can I help you practice English today, ${saved.name}?`,
          vi: `Hôm nay mình có thể giúp ${saved.name} luyện tiếng Anh như thế nào nào?`,
          anim: "CURIOUS_TILT"
        }
      ], `🧠 Đã ghi nhớ thành viên: ${saved.name} (${saved.age}t)`);
      return;
    }
  }

  // 2. Kiểm tra xem Phụ huynh có đang hỏi lịch sử học của con không
  const lower = text.toLowerCase();
  if (
    lower.includes("what did bi") ||
    lower.includes("bi learn") ||
    lower.includes("con học") ||
    lower.includes("con tôi") ||
    lower.includes("học gì") ||
    lower.includes("nói gì với bạn")
  ) {
    const report = MemoryEngine.buildParentReportForChild("Bi");
    deliverMultiBubbleReply([
      {
        en: report.enBubbles[0],
        vi: report.viSummary,
        anim: "LOVE_WARM"
      },
      {
        en: report.enBubbles[1],
        vi: "Mình luôn lưu lại tiến độ học của bé để báo cáo cho bố mẹ!",
        anim: "HAPPY_EXCITED"
      }
    ], "👨‍👩‍👧‍👦 Dữ liệu Ngữ cảnh Gia đình");
    return;
  }

  // 3. Nếu người dùng hỏi nghĩa tiếng Việt ("nghĩa là gì", "không hiểu", "translate")
  if (
    lower.includes("nghĩa là gì") ||
    lower.includes("không hiểu") ||
    lower.includes("dịch") ||
    lower.includes("what does that mean") ||
    lower.includes("i don't understand")
  ) {
    const botLogs = MemoryEngine.getMemberHistory(active.name, 6).filter(x => x.sender === "bot");
    const lastBot = botLogs.length > 0 ? botLogs[botLogs.length - 1].text : "Hello! Let's speak English!";
    const tr = await BilingualEngine.translateToVietnamese(lastBot);
    deliverMultiBubbleReply([
      {
        en: `No problem, ${active.name}! Here is what it means:`,
        vi: `Không sao đâu ${active.name}! Câu "${lastBot}" có nghĩa là: "${tr.vi}".`,
        speakViAfter: true,
        anim: "LOVE_WARM"
      }
    ], "🇻🇳 Giải thích Song ngữ");
    return;
  }

  // 4. Luồng xử lý chính: Backend API + Local AI nhẹ -> Chia nhỏ thành nhiều bong bóng qua lại
  window.__robotBusy = true;
  setRobotExpression("THINKING_PONDER");
  const typingEl = showTypingIndicator();

  const tStart = performance.now();
  const mode = document.getElementById("modeSelect").value;
  const persona = document.getElementById("personaSelect").value;

  let apiMs = 0;
  let aiMs = 0;
  let backendData = null;

  // Bước A: Gọi Backend Retrieval API (< 3ms server) nếu ở Mode 1 hoặc 2
  if (mode === "1" || mode === "2") {
    const tApi0 = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3200);
      const res = await fetch(apiChatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          bot_id: "ROBOT_2027_V23",
          member_name: active.name,
          member_age: active.age,
          persona: persona,
          tier: "PRO",
          text: text
        })
      });
      clearTimeout(timeout);
      if (res.ok) {
        backendData = await res.json();
      }
    } catch (e) {
      // Mất mạng -> tự động chuyển sang Offline / AI Local không báo lỗi đứng app
    }
    apiMs = Math.round(performance.now() - tApi0);
  }

  // Xây dựng mảng nhiều bong bóng hội thoại (Multi-Bubble Turns)
  const bubbles = [];
  let mainTopic = (backendData && backendData.topic) ? backendData.topic : "general";
  let mainAnim = (backendData && backendData.anim) ? backendData.anim : "SPEAKING_CHEERFUL";

  if (backendData && Array.isArray(backendData.candidates) && backendData.candidates.length > 0) {
    const top = backendData.candidates[0];
    if (top.fact) {
      bubbles.push({
        en: top.fact,
        vi: BilingualEngine.offlineTranslate(top.fact),
        anim: mainAnim
      });
    }
    if (top.follow_up) {
      bubbles.push({
        en: top.follow_up,
        vi: BilingualEngine.offlineTranslate(top.follow_up),
        anim: "CURIOUS_TILT"
      });
    }
  }

  // Bước B: Nếu bật Mode 2 (Song hành) hoặc Mode 3 (Thuần AI Local) và đã nạp GGUF
  if ((mode === "2" || mode === "3") && LlamaLocal) {
    try {
      const st = await LlamaLocal.getStatus();
      if (st && st.loaded) {
        const recent = MemoryEngine.getMemberHistory(active.name, 4)
          .map(m => `${m.sender === "user" ? active.name : "Robo"}: ${m.text}`)
          .join(" | ");

        const sys = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.ENGLISH_TEACHER;
        const seedFact = bubbles.length > 0 ? ` Context hint: ${bubbles[0].en}` : "";
        const prompt = `<|im_start|>system
${sys} Talking to ${active.name} (${active.age}yo). Recent: ${recent}.${seedFact}<|im_end|>
<|im_start|>user
${text}<|im_end|>
<|im_start|>assistant
`;

        const aiRes = await LlamaLocal.generate({ prompt, maxTokens: 26 });
        aiMs = aiRes.ms || 0;
        const aiLine = (aiRes.text || "").trim();

        if (aiLine && aiLine.length >= 4) {
          if (bubbles.length === 0) {
            bubbles.push({
              en: aiLine,
              vi: BilingualEngine.offlineTranslate(aiLine),
              anim: "SPEAKING_CHEERFUL"
            });
          } else if (aiLine.toLowerCase() !== bubbles[0].en.toLowerCase()) {
            // Đưa câu sinh tự nhiên của AI Local làm nhịp mở đầu hoặc nhịp nối tiếp sinh động
            bubbles[0].en = aiLine;
            bubbles[0].vi = BilingualEngine.offlineTranslate(aiLine);
          }
        }
      }
    } catch (e) {}
  }

  // Bước C: Dự phòng thông minh nếu không có cả mạng lẫn model AI
  if (bubbles.length === 0) {
    const offlineFallback = generateSmartOfflineReply(text, active.name);
    bubbles.push(...offlineFallback);
  }

  removeTypingIndicator(typingEl);

  const totalMs = Math.round(performance.now() - tStart);
  document.getElementById("speedBadge").textContent = `⚡ ${totalMs} ms`;

  const metaTag = `🌐+🧠 Chế độ ${mode} (API ${apiMs}ms${aiMs ? ` + AI ${aiMs}ms` : ""}) • ${persona}`;

  // Cập nhật gợi ý câu trả lời tiếp theo cho bé
  updateContextualChips(mainTopic, text);

  // Phát từng bong bóng tuần tự qua lại như người thật!
  await deliverMultiBubbleReply(bubbles, metaTag, mainTopic);
}

function generateSmartOfflineReply(userText, name) {
  const l = userText.toLowerCase();
  if (l.includes("hide") || l.includes("play")) {
    return [
      { en: `Hide and seek is super fun, ${name}!`, vi: `Trò trốn tìm siêu vui luôn đó, ${name}!`, anim: "HAPPY_EXCITED" },
      { en: `Close your eyes and count to ten! Where will you hide?`, vi: `Nhắm mắt lại và đếm tới 10 nhé! Bạn sẽ trốn ở đâu nào?`, anim: "PLAYFUL_WINK" }
    ];
  }
  if (l.includes("mom") || l.includes("dad") || l.includes("family")) {
    return [
      { en: `Family is the best treasure, ${name}!`, vi: `Gia đình là kho báu tuyệt vời nhất đó, ${name}!`, anim: "LOVE_WARM" },
      { en: `What do you like doing with your family on weekends?`, vi: `Cuối tuần bạn thích làm gì cùng gia đình nhất?`, anim: "CURIOUS_TILT" }
    ];
  }
  return [
    { en: `That sounds awesome, ${name}! Tell me more about it.`, vi: `Nghe tuyệt quá, ${name}! Kể cho mình nghe thêm đi.`, anim: "SPEAKING_CHEERFUL" },
    { en: `Can you say another sentence in English?`, vi: `Bạn thử nói thêm một câu bằng tiếng Anh nữa nhé?`, anim: "CURIOUS_TILT" }
  ];
}

function updateContextualChips(topic, userText) {
  if (topic === "games" || userText.toLowerCase().includes("play")) {
    renderQuickChips([
      "I hide behind the door!",
      "Tell me a fun riddle",
      "Let's play word game",
      "What did Bi learn today?"
    ]);
  } else if (topic === "family") {
    renderQuickChips([
      "My mom cooks yummy food",
      "My dad is very funny",
      "I love my family",
      "Let's play a game!"
    ]);
  } else {
    renderQuickChips([
      "Yes, let's do it!",
      "Tell me more!",
      "What is your favorite animal?",
      "Nghĩa là gì vậy Robo?"
    ]);
  }
}

// ==================== MULTI-BUBBLE SEQUENTIAL DELIVERY ====================
async function deliverMultiBubbleReply(bubbles, metaLabel = "", topic = "general") {
  window.__robotBusy = true;
  const active = MemoryEngine.getActiveMember();

  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];

    if (i > 0) {
      // Hiệu ứng đang gõ / suy nghĩ giữa các câu cho tự nhiên
      const typing = showTypingIndicator();
      await sleep(550);
      removeTypingIndicator(typing);
    }

    setRobotExpression(b.anim || "SPEAKING_CHEERFUL");
    appendChatBubble("bot", b.en, "Robo", i === bubbles.length - 1 ? metaLabel : "", b.vi || "");
    MemoryEngine.appendChatLog(active.name, "bot", b.en, topic);
    ProactiveEngine.setLastBotUtterance(b.en);

    // Đọc câu tiếng Anh & chờ đọc xong mới sang bong bóng kế tiếp
    await speakText(b.en, "en-US");

    // Nếu là bong bóng cứu nguy song ngữ, đọc tiếp phần giải thích tiếng Việt
    if (b.speakViAfter && b.vi) {
      await sleep(250);
      await speakText(b.vi, "vi-VN");
    }

    await sleep(300);
  }

  window.__robotBusy = false;
  setRobotExpression("IDLE_ALIVE");
  ProactiveEngine.resetTimer();
  ProactiveEngine.start();
}

// ==================== CHAT UI & TRANSLATION BUTTON ====================
function appendChatBubble(sender, text, authorName, metaText = "", preTranslatedVi = "") {
  const stream = document.getElementById("chatStream");
  const row = document.createElement("div");
  row.className = `bubble-row ${sender}`;

  const safeText = escapeHtml(text);
  const bubbleId = "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

  row.innerHTML = `
    <div class="bubble" id="${bubbleId}">
      <div class="bubble-top">
        <div class="bubble-text">${safeText}</div>
        <div class="bubble-tools">
          <button class="mini-tool-btn" title="Nghe phát âm" onclick="replayBubbleSpeech('${bubbleId}', 'en-US')">🔊</button>
          <button class="mini-tool-btn vi-btn" title="Dịch sang tiếng Việt" onclick="toggleBubbleTranslate('${bubbleId}')">🇻🇳 Dịch</button>
        </div>
      </div>
      <div class="vi-translation-box" id="${bubbleId}_vi" style="display:${preTranslatedVi ? "flex" : "none"};">
        <span id="${bubbleId}_vi_text">${preTranslatedVi ? "🇻🇳 " + escapeHtml(preTranslatedVi) : ""}</span>
        <button class="mini-tool-btn" title="Nghe giọng Việt" onclick="replayBubbleSpeech('${bubbleId}', 'vi-VN')">🔊</button>
      </div>
      ${metaText ? `<div class="bubble-meta">${escapeHtml(metaText)}</div>` : ""}
    </div>
  `;

  row.dataset.enText = text;
  row.dataset.viText = preTranslatedVi || "";

  stream.appendChild(row);
  stream.scrollTop = stream.scrollHeight;
}

async function toggleBubbleTranslate(bubbleId) {
  const bubbleEl = document.getElementById(bubbleId);
  if (!bubbleEl) return;
  const row = bubbleEl.parentElement;
  const viBox = document.getElementById(`${bubbleId}_vi`);
  const viTextEl = document.getElementById(`${bubbleId}_vi_text`);

  if (viBox.style.display === "flex" && row.dataset.viText) {
    viBox.style.display = "none";
    return;
  }

  viBox.style.display = "flex";
  if (!row.dataset.viText) {
    viTextEl.textContent = "⏳ Đang dịch sang tiếng Việt...";
    const res = await BilingualEngine.translateToVietnamese(row.dataset.enText);
    const vocabStr = res.vocab.length > 0
      ? ` (${res.vocab.map(v => `${v.w}: ${v.vi}`).join(", ")})`
      : "";
    row.dataset.viText = res.vi + vocabStr;
  }
  viTextEl.textContent = "🇻🇳 " + row.dataset.viText;
}

async function replayBubbleSpeech(bubbleId, lang) {
  const bubbleEl = document.getElementById(bubbleId);
  if (!bubbleEl) return;
  const row = bubbleEl.parentElement;
  ProactiveEngine.resetTimer();

  if (lang === "vi-VN") {
    if (!row.dataset.viText) {
      await toggleBubbleTranslate(bubbleId);
    }
    await speakText(row.dataset.viText, "vi-VN");
  } else {
    setRobotExpression("SPEAKING_CHEERFUL");
    await speakText(row.dataset.enText, "en-US");
    setRobotExpression("IDLE_ALIVE");
  }
}

function appendSystemNotice(msg) {
  const stream = document.getElementById("chatStream");
  const div = document.createElement("div");
  div.style.cssText = "align-self:center; background:#1e293b; border:1px solid #334155; color:#cbd5e1; font-size:12px; padding:6px 12px; border-radius:12px; text-align:center; max-width:90%;";
  div.textContent = msg;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

function showTypingIndicator() {
  const stream = document.getElementById("chatStream");
  const div = document.createElement("div");
  div.className = "typing-bubble";
  div.textContent = "🤖 Robo đang nói tiếp...";
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
  return div;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function renderQuickChips(chips) {
  const box = document.getElementById("quickChips");
  box.innerHTML = "";
  chips.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = `"${c}"`;
    btn.onclick = () => {
      document.getElementById("chatInput").value = c;
      handleUserSend();
    };
    box.appendChild(btn);
  });
}

// ==================== SPEECH & MICROPHONE ====================
function toggleMic() {
  ProactiveEngine.resetTimer();
  const micBtn = document.getElementById("micBtn");

  if (SpeechBridge) {
    if (isListening) {
      SpeechBridge.stopListening();
      isListening = false;
      window.__robotBusy = false;
      micBtn.classList.remove("listening");
      setRobotExpression("IDLE_ALIVE");
    } else {
      SpeechBridge.startListening({ lang: "en-US" }).catch(err => {
        appendSystemNotice("⚠️ " + (err.message || "Không mở được Micro"));
      });
    }
    return;
  }

  // Fallback Web Speech API nếu mở trên trình duyệt PC
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    appendSystemNotice("⚠️ Trình duyệt này không hỗ trợ nhận diện giọng nói.");
    return;
  }
  const rec = new SR();
  rec.lang = "en-US";
  rec.onstart = () => {
    isListening = true;
    micBtn.classList.add("listening");
    setRobotExpression("LISTENING_ATTENTIVE");
  };
  rec.onresult = (e) => {
    const txt = e.results[0][0].transcript;
    document.getElementById("chatInput").value = txt;
    handleUserSend();
  };
  rec.onend = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    setRobotExpression("IDLE_ALIVE");
  };
  rec.start();
}

function speakText(text, lang = "en-US") {
  return new Promise(async (resolve) => {
    const clean = (text || "").replace(/[*_#]/g, "").trim();
    if (!clean) return resolve();

    const estDuration = Math.min(6500, Math.max(1100, clean.length * 62));

    if (SpeechBridge) {
      setMouthSpeaking(true);
      try {
        await SpeechBridge.speak({
          text: clean,
          lang: lang,
          rate: lang === "vi-VN" ? 1.02 : 0.95,
          pitch: 1.05
        });
      } catch (e) {}
      setTimeout(() => {
        setMouthSpeaking(false);
        resolve();
      }, estDuration);
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      u.rate = 0.96;
      setMouthSpeaking(true);
      u.onend = () => {
        setMouthSpeaking(false);
        resolve();
      };
      u.onerror = () => {
        setMouthSpeaking(false);
        resolve();
      };
      window.speechSynthesis.speak(u);
      setTimeout(() => {
        setMouthSpeaking(false);
        resolve();
      }, estDuration + 800);
    } else {
      resolve();
    }
  });
}

// ==================== 10 REAL-TIME ROBOT EXPRESSIONS ====================
function setRobotExpression(state) {
  currentAnim = state;
  document.getElementById("animStateLabel").textContent = state;

  const wrapper = document.getElementById("faceWrapper");
  const browL = document.getElementById("browLeft");
  const browR = document.getElementById("browRight");
  const cheekL = document.getElementById("cheekLeft");
  const cheekR = document.getElementById("cheekRight");
  const mouth = document.getElementById("robotMouth");
  const lidR = document.getElementById("lidRight");

  wrapper.classList.remove("tilt", "bounce");
  browL.setAttribute("transform", "");
  browR.setAttribute("transform", "");
  cheekL.setAttribute("opacity", "0.2");
  cheekR.setAttribute("opacity", "0.2");
  lidR.setAttribute("height", "0");
  mouth.setAttribute("rx", "4");
  mouth.setAttribute("height", "8");

  switch (state) {
    case "HAPPY_EXCITED":
      wrapper.classList.add("bounce");
      cheekL.setAttribute("opacity", "0.75");
      cheekR.setAttribute("opacity", "0.75");
      mouth.setAttribute("height", "16");
      mouth.setAttribute("rx", "8");
      break;
    case "LOVE_WARM":
      cheekL.setAttribute("opacity", "0.9");
      cheekR.setAttribute("opacity", "0.9");
      browL.setAttribute("transform", "rotate(-8 75 27)");
      browR.setAttribute("transform", "rotate(8 165 27)");
      break;
    case "CURIOUS_TILT":
      wrapper.classList.add("tilt");
      browL.setAttribute("transform", "translate(0,-4)");
      break;
    case "PLAYFUL_WINK":
      lidR.setAttribute("height", "24");
      cheekR.setAttribute("opacity", "0.7");
      break;
    case "THINKING_PONDER":
      browL.setAttribute("transform", "rotate(10 75 27)");
      browR.setAttribute("transform", "translate(0,-5)");
      break;
    case "LISTENING_ATTENTIVE":
      browL.setAttribute("transform", "translate(0,-4)");
      browR.setAttribute("transform", "translate(0,-4)");
      mouth.setAttribute("width", "26");
      mouth.setAttribute("x", "107");
      break;
    default:
      mouth.setAttribute("width", "44");
      mouth.setAttribute("x", "98");
      break;
  }
}

function setMouthSpeaking(active) {
  const mouth = document.getElementById("robotMouth");
  if (active) {
    mouth.classList.add("mouth-speaking");
  } else {
    mouth.classList.remove("mouth-speaking");
  }
}

function startBlinkLoop() {
  setInterval(() => {
    if (currentAnim === "PLAYFUL_WINK") return;
    const lidL = document.getElementById("lidLeft");
    const lidR = document.getElementById("lidRight");
    lidL.setAttribute("height", "44");
    lidR.setAttribute("height", "44");
    setTimeout(() => {
      lidL.setAttribute("height", "0");
      if (currentAnim !== "PLAYFUL_WINK") lidR.setAttribute("height", "0");
    }, 130);
  }, 3600);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

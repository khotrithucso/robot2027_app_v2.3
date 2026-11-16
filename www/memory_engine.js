// Robot 2027 V2.3 - Family & Cross-Member Context Memory Engine
window.MemoryEngine = (function () {
  const MEMBERS_KEY = "robot2027_family_members_v23";
  const HISTORY_KEY = "robot2027_chat_history_v23";
  const ACTIVE_KEY  = "robot2027_active_member_v23";

  // Danh sách từ tuyệt đối không nhận nhầm làm tên người
  const NON_NAME_WORDS = new Set([
    "me", "i", "you", "robot", "robo", "hundred", "hello", "hi", "hey",
    "yes", "no", "ok", "okay", "fine", "good", "great", "free", "tired",
    "hungry", "happy", "sad", "play", "hide", "seek", "english", "learn",
    "learning", "learninh", "today", "mom", "mommy", "dad", "daddy", "seafood"
  ]);

  function loadMembers() {
    try {
      const raw = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "null");
      if (Array.isArray(raw) && raw.length > 0) return raw;
    } catch (e) {}
    return [
      { id: "m_bi", name: "Bi", age: 6, role: "CHILD", persona: "ENGLISH_TEACHER" },
      { id: "m_dad", name: "Dad", age: 35, role: "PARENT", persona: "FAMILY_MANAGER" }
    ];
  }

  function saveMembers(list) {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(list));
  }

  function getActiveMember() {
    const list = loadMembers();
    const activeId = localStorage.getItem(ACTIVE_KEY);
    return list.find(m => m.id === activeId) || list[0];
  }

  function setActiveMemberId(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  function upsertMember(name, age = 6, role = null, persona = "ENGLISH_TEACHER") {
    const cleanName = (name || "").trim();
    if (!cleanName || cleanName.length < 2) return null;
    if (NON_NAME_WORDS.has(cleanName.toLowerCase())) return null;

    const list = loadMembers();
    const detectedRole = role || (age >= 18 ? "PARENT" : "CHILD");
    let found = list.find(m => m.name.toLowerCase() === cleanName.toLowerCase());

    if (found) {
      if (age) found.age = age;
      if (role) found.role = role;
      if (persona) found.persona = persona;
    } else {
      found = {
        id: "m_" + Date.now(),
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        age: age || 6,
        role: detectedRole,
        persona: persona || "ENGLISH_TEACHER"
      };
      list.push(found);
    }

    saveMembers(list);
    setActiveMemberId(found.id);
    return found;
  }

  function deleteMember(id) {
    let list = loadMembers().filter(m => m.id !== id);
    if (list.length === 0) {
      list = [{ id: "m_bi", name: "Bi", age: 6, role: "CHILD", persona: "ENGLISH_TEACHER" }];
    }
    saveMembers(list);
    setActiveMemberId(list[0].id);
    return list[0];
  }

  function extractNameAndAge(text) {
    const t = (text || "").trim();
    let name = null;
    let age = null;

    // Bắt tuổi: "6 years old", "I am 6", "6t"
    const ageMatch = t.match(/\b(\d{1,2})\s*(?:years?\s*old|yo|tuổi|t)\b/i) || t.match(/\bi\s*(?:am|'m)\s*(\d{1,2})\b/i);
    if (ageMatch) {
      const parsedAge = parseInt(ageMatch[1], 10);
      if (parsedAge >= 2 && parsedAge <= 95) age = parsedAge;
    }

    // Bắt tên: "My name is Bi", "I am Dad", "I'm Mom", "Call me Bi"
    const nameMatch = t.match(/(?:my name is|call me|i am|i'm|tên là|mình là)\s+([a-zA-ZÀ-ỹ]{2,16})/i);
    if (nameMatch) {
      const candidate = nameMatch[1].trim();
      if (!NON_NAME_WORDS.has(candidate.toLowerCase())) {
        name = candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase();
      }
    }

    return { name, age };
  }

  // Lịch sử trò chuyện tách riêng từng thành viên
  function loadAllHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function appendChatLog(memberName, sender, text, topic = "general") {
    const key = (memberName || "Bi").toLowerCase();
    const all = loadAllHistory();
    if (!Array.isArray(all[key])) all[key] = [];

    all[key].push({
      sender, // "user" | "bot"
      text,
      topic,
      ts: Date.now()
    });

    if (all[key].length > 50) {
      all[key] = all[key].slice(-50);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  }

  function getMemberHistory(memberName, limit = 6) {
    const key = (memberName || "Bi").toLowerCase();
    const all = loadAllHistory();
    const list = Array.isArray(all[key]) ? all[key] : [];
    return list.slice(-limit);
  }

  function buildParentReportForChild(childName) {
    const all = loadAllHistory();
    const members = loadMembers();
    const target = members.find(m => m.name.toLowerCase() === (childName || "").toLowerCase())
                || members.find(m => m.role === "CHILD")
                || members[0];

    const logs = all[target.name.toLowerCase()] || [];
    const userLines = logs.filter(l => l.sender === "user").map(l => l.text);
    const topics = [...new Set(logs.map(l => l.topic).filter(t => t && t !== "general"))];

    if (userLines.length === 0) {
      return {
        enBubbles: [
          `${target.name} hasn't practiced with me yet today!`,
          `Let's invite ${target.name} to play a fun English game together!`
        ],
        viSummary: `Hôm nay bé ${target.name} chưa trò chuyện với Robot. Bạn có thể gọi bé vào luyện nói tiếng Anh ngay bây giờ!`
      };
    }

    const recentSamples = userLines.slice(-3).join('", "');
    const topicStr = topics.length > 0 ? topics.join(", ") : "daily conversation";

    return {
      enBubbles: [
        `Today I chatted with ${target.name} (${userLines.length} messages) about ${topicStr}!`,
        `${target.name} practiced saying: "${recentSamples}". Great progress!`
      ],
      viSummary: `Báo cáo học tập của ${target.name}: Bé đã nói ${userLines.length} lượt về chủ đề [${topicStr}]. Các câu bé vừa luyện: "${recentSamples}".`
    };
  }

  return {
    loadMembers,
    saveMembers,
    getActiveMember,
    setActiveMemberId,
    upsertMember,
    deleteMember,
    extractNameAndAge,
    appendChatLog,
    getMemberHistory,
    buildParentReportForChild
  };
})();

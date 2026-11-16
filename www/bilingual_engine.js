// Robot 2027 V2.3 - Bilingual Engine (Offline 0ms + Online Free Translation + En/Vi Speech)
window.BilingualEngine = (function () {
  const PHRASE_DICT = {
    "hello! i am robot 2027. what is your name?": "Xin chào! Mình là Robot 2027. Bạn tên là gì?",
    "how can i help you today?": "Hôm nay mình có thể giúp gì cho bạn nào?",
    "let us play hide and seek": "Chúng ta hãy cùng chơi trò trốn tìm nhé!",
    "hide and seek is super fun!": "Trò trốn tìm siêu vui luôn đó!",
    "where is your favorite hiding spot?": "Chỗ trốn yêu thích của bạn ở đâu?",
    "moms are real-life superheroes!": "Các bà mẹ chính là những siêu anh hùng ngoài đời thực!",
    "did you give your mom a big hug today?": "Hôm nay bạn đã ôm mẹ một cái thật chặt chưa?",
    "dads are strong and funny!": "Các ông bố vừa khỏe mạnh lại vừa vui tính!",
    "what games do you play with your dad?": "Bạn thường chơi trò gì cùng với bố?",
    "what is your favorite animal?": "Con vật yêu thích của bạn là gì?",
    "what is your favorite color?": "Màu sắc yêu thích của bạn là gì?",
    "what is your favorite food?": "Món ăn yêu thích của bạn là gì?",
    "are you hungry or thirsty?": "Bạn đang đói bụng hay khát nước không?",
    "let's practice english together!": "Hãy cùng nhau luyện tập tiếng Anh nhé!",
    "you are doing great!": "Bạn đang làm rất tốt luôn!",
    "can you repeat after me?": "Bạn có thể nhắc lại theo mình không?",
    "i see you're getting the hang of it.": "Mình thấy bạn đang bắt đầu quen và làm rất tốt rồi đấy!",
    "i am free today": "Hôm nay mình rảnh rỗi.",
    "i love my mommy": "Con rất yêu mẹ của con.",
    "play hide and seek": "Chơi trò trốn tìm."
  };

  const WORD_GLOSSARY = {
    "hello": "xin chào",
    "name": "tên",
    "mother": "mẹ",
    "mom": "mẹ",
    "mommy": "mẹ yêu",
    "father": "bố / cha",
    "dad": "bố",
    "sister": "chị / em gái",
    "brother": "anh / em trai",
    "family": "gia đình",
    "friend": "bạn bè",
    "play": "chơi",
    "game": "trò chơi",
    "hide": "trốn",
    "seek": "tìm",
    "superhero": "siêu anh hùng",
    "superheroes": "những siêu anh hùng",
    "hug": "cái ôm",
    "cook": "nấu ăn",
    "cooking": "đang nấu ăn",
    "food": "đồ ăn",
    "seafood": "hải sản",
    "animal": "động vật / con vật",
    "dog": "con chó",
    "cat": "con mèo",
    "color": "màu sắc",
    "happy": "vui vẻ",
    "tired": "mệt mỏi",
    "hungry": "đói bụng",
    "water": "nước",
    "school": "trường học",
    "teacher": "giáo viên",
    "learn": "học",
    "english": "tiếng Anh",
    "riddle": "câu đố",
    "toy": "đồ chơi",
    "robot": "người máy",
    "favorite": "yêu thích nhất",
    "wonderful": "tuyệt vời",
    "together": "cùng nhau"
  };

  const cache = JSON.parse(localStorage.getItem("robot2027_vi_cache") || "{}");

  function saveCache() {
    try {
      const keys = Object.keys(cache);
      if (keys.length > 300) {
        delete cache[keys[0]];
      }
      localStorage.setItem("robot2027_vi_cache", JSON.stringify(cache));
    } catch (e) {}
  }

  function extractKeyVocab(enText) {
    const words = (enText || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);
    const found = [];
    for (const w of words) {
      if (WORD_GLOSSARY[w] && !found.some(x => x.w === w)) {
        found.push({ w, vi: WORD_GLOSSARY[w] });
      }
      if (found.length >= 3) break;
    }
    return found;
  }

  function offlineTranslate(enText) {
    const clean = (enText || "").trim();
    const lower = clean.toLowerCase();
    if (!clean) return "";
    if (cache[lower]) return cache[lower];
    if (PHRASE_DICT[lower]) return PHRASE_DICT[lower];

    // Ghép từng vế câu nếu câu dài có nhiều dấu chấm/hỏi
    const parts = clean.split(/(?<=[.!?])\s+/);
    if (parts.length > 1) {
      const translatedParts = parts.map(p => PHRASE_DICT[p.toLowerCase()] || null);
      if (translatedParts.every(Boolean)) {
        return translatedParts.join(" ");
      }
    }

    const vocab = extractKeyVocab(clean);
    if (vocab.length > 0) {
      const hints = vocab.map(v => `${v.w} (${v.vi})`).join(", ");
      return `Từ khóa chính: ${hints}`;
    }
    return "";
  }

  async function translateToVietnamese(enText) {
    const clean = (enText || "").trim();
    const lower = clean.toLowerCase();
    if (!clean) return { vi: "", vocab: [] };

    const vocab = extractKeyVocab(clean);
    if (cache[lower]) {
      return { vi: cache[lower], vocab };
    }
    if (PHRASE_DICT[lower]) {
      return { vi: PHRASE_DICT[lower], vocab };
    }

    // Thử dịch trực tuyến miễn phí qua Google Translate GTX endpoint (không cần API key)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(clean)}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const fullVi = data[0].map(seg => seg[0] || "").join("").trim();
          if (fullVi) {
            cache[lower] = fullVi;
            saveCache();
            return { vi: fullVi, vocab };
          }
        }
      }
    } catch (e) {
      // Mất mạng -> rơi về từ điển offline
    }

    const fb = offlineTranslate(clean) || "Chưa có mạng để dịch cả câu, hãy bấm thử lại khi có Wi-Fi/4G nhé!";
    return { vi: fb, vocab };
  }

  return {
    translateToVietnamese,
    offlineTranslate,
    extractKeyVocab
  };
})();

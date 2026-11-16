// Robot 2027 V2.3 - Proactive Conversation & Bilingual Rescue Engine
window.ProactiveEngine = (function () {
  let enabled = localStorage.getItem("robot2027_proactive_enabled") !== "false";
  let timerId = null;
  let idleSeconds = 0;
  let stageTriggered = 0;
  let lastBotSentence = "";
  let onProactiveTrigger = null;
  let onTickUpdate = null;

  const STARTER_TOPICS = [
    {
      en: "By the way, what is your favorite animal? Do you like dogs or cats?",
      vi: "Nhân tiện, con vật yêu thích của bạn là gì? Bạn thích chó hay mèo?",
      hint: "I like dogs",
      anim: "CURIOUS_TILT"
    },
    {
      en: "Let's play a quick riddle! What gets wetter the more it dries? A towel!",
      vi: "Chơi đố vui nhanh nhé! Cái gì càng lau khô thì lại càng ướt? Là cái khăn tắm đó!",
      hint: "Tell me another riddle",
      anim: "PLAYFUL_WINK"
    },
    {
      en: "Tell me about your family! What does your mom or dad like to do?",
      vi: "Kể cho mình nghe về gia đình bạn đi! Bố hoặc mẹ bạn thích làm gì?",
      hint: "My mom likes cooking",
      anim: "LOVE_WARM"
    },
    {
      en: "Are you hungry or thirsty right now? What is your favorite food?",
      vi: "Bây giờ bạn có đói hay khát không? Món ăn yêu thích của bạn là gì?",
      hint: "I love seafood and rice",
      anim: "HAPPY_EXCITED"
    }
  ];

  let topicCursor = 0;

  function isEnabled() {
    return enabled;
  }

  function setEnabled(val) {
    enabled = !!val;
    localStorage.setItem("robot2027_proactive_enabled", enabled ? "true" : "false");
    if (!enabled) {
      stop();
    } else {
      resetTimer();
    }
  }

  function init(callbacks) {
    onProactiveTrigger = callbacks.onTrigger;
    onTickUpdate = callbacks.onTick;
  }

  function setLastBotUtterance(sentence) {
    lastBotSentence = (sentence || "").trim();
    stageTriggered = 0;
    idleSeconds = 0;
  }

  function resetTimer() {
    idleSeconds = 0;
    stageTriggered = 0;
    if (onTickUpdate) onTickUpdate(0, enabled);
  }

  function start() {
    stop();
    if (!enabled) return;

    timerId = setInterval(() => {
      if (!enabled) return;
      // Không đếm khi bot đang nói hoặc micro đang nghe
      if (window.__robotBusy) return;

      idleSeconds++;
      if (onTickUpdate) onTickUpdate(idleSeconds, enabled);

      // MỐC 1 (8 giây im lặng): Cứu nguy song ngữ — giải thích nghĩa câu vừa nói & gợi ý cách trả lời
      if (idleSeconds >= 8 && stageTriggered === 0) {
        stageTriggered = 1;
        if (onProactiveTrigger) {
          onProactiveTrigger({
            stage: 1,
            lastBotSentence
          });
        }
      }
      // MỐC 2 (19 giây im lặng): Chủ động khơi gợi chủ đề mới / câu đố vui để giữ liền mạch
      else if (idleSeconds >= 19 && stageTriggered === 1) {
        stageTriggered = 2;
        const pick = STARTER_TOPICS[topicCursor % STARTER_TOPICS.length];
        topicCursor++;
        if (onProactiveTrigger) {
          onProactiveTrigger({
            stage: 2,
            topic: pick
          });
        }
      }
    }, 1000);
  }

  function stop() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  return {
    isEnabled,
    setEnabled,
    init,
    setLastBotUtterance,
    resetTimer,
    start,
    stop
  };
})();

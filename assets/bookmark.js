// assets/bookmark.js —— 全站通用智能快捷收藏助手 (Ctrl+D / ⌘+D)
(function () {
  const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent || "");
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
  const keyStr = isMac ? "⌘+D" : "Ctrl+D";

  // 同步页面上的所有快捷键提示文字
  document.querySelectorAll("#bookmarkKbd, .bookmark-kbd").forEach((el) => {
    el.textContent = keyStr;
    if (isMobile) el.hidden = true;
  });

  const I18N = {
    zh: {
      title: `按 <kbd class="bookmark-toast-kbd">${keyStr}</kbd> 快速加入书签`,
      desc: "本页链接已复制到剪贴板！随时回访不迷路。",
      mTitle: "⭐ 添加至书签 / 主屏幕",
      mDesc: "点击浏览器底部分享或菜单按钮，选择「添加到主屏幕」或「加入书签」即可随时快速打开！",
    },
    en: {
      title: `Press <kbd class="bookmark-toast-kbd">${keyStr}</kbd> to bookmark`,
      desc: "URL copied to clipboard! Access anytime without losing track.",
      mTitle: "⭐ Add to Bookmarks / Home Screen",
      mDesc: "Tap browser menu/share button and choose 'Add to Home Screen' or 'Bookmark' for instant access!",
    },
    "zh-Hant": {
      title: `按 <kbd class="bookmark-toast-kbd">${keyStr}</kbd> 快速加入書籤`,
      desc: "本頁連結已複製到剪貼簿！隨時回訪不迷路。",
      mTitle: "⭐ 加入書籤 / 主畫面",
      mDesc: "點擊瀏覽器底部分享或選單按鈕，選擇「加入主畫面」或「加入書籤」即可隨時快速開啟！",
    },
    ja: {
      title: `<kbd class="bookmark-toast-kbd">${keyStr}</kbd> でブックマークに追加`,
      desc: "URLをクリップボードにコピーしました！いつでも再訪可能。",
      mTitle: "⭐ ブックマーク / ホーム画面に追加",
      mDesc: "ブラウザの共有/メニューボタンから「ホーム画面に追加」または「ブックマーク」を選択してください！",
    }
  };

  function getLang() {
    const l = document.documentElement.lang || navigator.language || "zh";
    if (l.startsWith("zh-TW") || l.startsWith("zh-HK") || l.startsWith("zh-Hant")) return "zh-Hant";
    if (l.startsWith("zh")) return "zh";
    if (l.startsWith("ja")) return "ja";
    return "en";
  }

  function showToast() {
    let wrap = document.querySelector(".bookmark-toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "bookmark-toast-wrap";
      document.body.appendChild(wrap);
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href);
      }
    } catch {}

    const lang = getLang();
    const t = I18N[lang] || I18N.zh;
    const title = isMobile ? t.mTitle : t.title;
    const desc = isMobile ? t.mDesc : t.desc;

    const toast = document.createElement("div");
    toast.className = "bookmark-toast";
    toast.innerHTML = `
      <span class="bookmark-toast-icon">⭐</span>
      <div class="bookmark-toast-body">
        <div class="bookmark-toast-title">${title}</div>
        <div class="bookmark-toast-desc">${desc}</div>
      </div>
      <button class="bookmark-toast-close" title="关闭" aria-label="关闭">&times;</button>
    `;

    const closeBtn = toast.querySelector(".bookmark-toast-close");
    let timer = null;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      toast.classList.add("toast-fadeout");
      setTimeout(() => toast.remove(), 220);
    };
    closeBtn?.addEventListener("click", dismiss);
    timer = setTimeout(dismiss, 3800);

    wrap.appendChild(toast);
  }

  document.querySelectorAll("#bookmarkBtn, .btn-bookmark").forEach((btn) => {
    btn.title = isMobile ? "收藏本页" : `收藏本页 (${keyStr})`;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showToast();
    });
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
      setTimeout(showToast, 200);
    }
  });
})();


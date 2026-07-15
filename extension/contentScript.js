(() => {
  if (document.getElementById("miles-extension-root")) {
    return;
  }

  const DEFAULT_SERVER_URL = "http://localhost:3003";
  const socialHosts = [
    "facebook",
    "x.com",
    "twitter.com",
    "instagram.com",
    "linkedin.com",
    "reddit.com",
    "youtube.com",
    "threads.net",
    "tiktok.com",
  ];

  const host = location.hostname.toLowerCase();
  const isSocialHost = socialHosts.some((item) => host === item || host.endsWith(`.${item}`));
  if (!isSocialHost) {
    return;
  }
  const isX = host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com");

  const root = document.createElement("div");
  root.id = "miles-extension-root";
  root.style.all = "initial";
  root.style.position = "fixed";
  root.style.zIndex = "2147483647";
  root.style.right = "18px";
  root.style.bottom = "18px";
  document.documentElement.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host, * { box-sizing: border-box; }
      .launcher {
        display: none;
        align-items: center;
        gap: 10px;
        border: 0;
        border-radius: 999px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #6d28d9, #2563eb);
        color: white;
        font: 600 13px/1.2 Arial, sans-serif;
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.35);
        cursor: pointer;
      }
      .panel {
        display: none;
        width: 360px;
        max-width: calc(100vw - 36px);
        margin-top: 10px;
        border-radius: 18px;
        overflow: hidden;
        background: #ffffff;
        border: 1px solid rgba(148, 163, 184, 0.3);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.25);
        font: 14px/1.5 Arial, sans-serif;
        color: #0f172a;
        max-height: 40vh;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .panel header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(109, 40, 217, 0.08));
        border-bottom: 1px solid rgba(148, 163, 184, 0.25);
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .title {
        font-weight: 700;
      }
      .icon-btn {
        border: 0;
        background: transparent;
        color: #475569;
        cursor: pointer;
        line-height: 1;
        padding: 2px 4px;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .body.hidden {
        display: none;
      }
      .body {
        padding: 16px;
        overflow-y: auto;
        max-height: calc(40vh - 58px);
        min-height: 0;
      }
      .meta {
        display: grid;
        gap: 8px;
        margin-bottom: 12px;
        min-height: 0;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        background: #eff6ff;
        color: #1d4ed8;
        font-size: 12px;
        font-weight: 700;
      }
      .score {
        font-size: 30px;
        font-weight: 800;
        margin: 2px 0;
      }
      .verdict {
        font-weight: 700;
      }
      .source {
        font-size: 12px;
        color: #475569;
        word-break: break-word;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
      }
      .btn {
        border: 0;
        border-radius: 10px;
        padding: 10px 12px;
        font: 600 13px/1 Arial, sans-serif;
        cursor: pointer;
      }
      .primary {
        background: #2563eb;
        color: white;
      }
      .secondary {
        background: #e2e8f0;
        color: #0f172a;
      }
      .helper {
        font-size: 12px;
        color: #64748b;
      }
      .loading {
        display: none;
        margin-top: 8px;
        color: #2563eb;
        font-size: 12px;
      }
      .error {
        display: none;
        margin-top: 10px;
        color: #b91c1c;
        font-size: 12px;
      }
      a { color: inherit; }
    </style>
    <button class="launcher" id="miles-launcher">
      ${isX ? "Analyze X post with MILES" : "Analyze with MILES"}
      <span id="miles-launcher-count" class="helper"></span>
    </button>
    <div class="panel" id="miles-panel" aria-live="polite">
      <header>
        <div class="title">MILES Verification</div>
        <div class="header-actions">
          <button class="icon-btn" id="miles-toggle" aria-label="Collapse or expand">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </button>
          <button class="icon-btn" id="miles-close" aria-label="Close">&times;</button>
        </div>
      </header>
      <div class="body" id="miles-body">
        <div class="meta">
          <div id="miles-sector" class="chip">No analysis yet</div>
          <div class="score" id="miles-score">--</div>
          <div class="verdict" id="miles-verdict">${isX ? "Open or select an X post, then analyze it." : "Select text on a post, then analyze it."}</div>
          <div class="helper" id="miles-summary"></div>
          <div class="source" id="miles-source"></div>
        </div>
        <div class="helper" id="miles-explanation"></div>
        <div class="loading" id="miles-loading">Analyzing selected content...</div>
        <div class="error" id="miles-error"></div>
        <div class="actions">
          <button class="btn primary" id="miles-analyze">Analyze selection</button>
          <button class="btn secondary" id="miles-open">Open MILES</button>
        </div>
      </div>
    </div>
  `;

  const launcher = shadow.getElementById("miles-launcher");
  const launcherCount = shadow.getElementById("miles-launcher-count");
  const panel = shadow.getElementById("miles-panel");
  const body = shadow.getElementById("miles-body");
  const closeBtn = shadow.getElementById("miles-close");
  const toggleBtn = shadow.getElementById("miles-toggle");
  const analyzeBtn = shadow.getElementById("miles-analyze");
  const openBtn = shadow.getElementById("miles-open");
  const scoreEl = shadow.getElementById("miles-score");
  const verdictEl = shadow.getElementById("miles-verdict");
  const summaryEl = shadow.getElementById("miles-summary");
  const explanationEl = shadow.getElementById("miles-explanation");
  const sourceEl = shadow.getElementById("miles-source");
  const loadingEl = shadow.getElementById("miles-loading");
  const errorEl = shadow.getElementById("miles-error");
  const sectorEl = shadow.getElementById("miles-sector");

  let selectedText = "";
  let selectionVisible = false;
  let xPostText = "";

  function setError(message) {
    errorEl.style.display = message ? "block" : "none";
    errorEl.textContent = message || "";
  }

  function setLoading(isLoading) {
    loadingEl.style.display = isLoading ? "block" : "none";
    analyzeBtn.disabled = isLoading;
    analyzeBtn.textContent = isLoading ? "Analyzing..." : "Analyze selection";
  }

  function openPanel() {
    panel.style.display = "block";
    body.classList.remove("hidden");
    toggleBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  }

  function closePanel() {
    panel.style.display = "none";
  }

  function togglePanelBody() {
    body.classList.toggle("hidden");
    toggleBtn.innerHTML = body.classList.contains("hidden")
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  }

  function renderResult(data) {
    const score = Number(data.credibilityScore ?? data.credibility_score ?? 0);
    const verdict = data.verdict_label || "Verified";
    const sector = data.sector || "General";
    const color = data.verdict_color || "#2563eb";

    sectorEl.textContent = sector;
    scoreEl.textContent = `${score}%`;
    scoreEl.style.color = color;
    verdictEl.textContent = verdict;
    verdictEl.style.color = color;
    summaryEl.textContent = data.summary || data.explanation || "Analysis complete.";
    explanationEl.textContent = data.explanation || "";
    sourceEl.textContent = data.contentExcerpt ? `Excerpt: ${data.contentExcerpt}` : "";
  }

  async function getServerUrl() {
    const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER_URL });
    return String(stored.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  }

  function getVisibleText(node) {
    if (!node) {
      return "";
    }
    const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
    const visible = !rect || (rect.width > 0 && rect.height > 0);
    if (!visible) {
      return "";
    }
    return String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function extractXPostText() {
    if (!isX) {
      return "";
    }

    const tweetCandidates = Array.from(
      document.querySelectorAll('article[data-testid="tweet"], article[role="article"], div[data-testid="tweetText"]')
    );

    for (const candidate of tweetCandidates) {
      const text = getVisibleText(candidate);
      if (text.length >= 30) {
        return text;
      }
    }

    const tweetTextBlocks = Array.from(document.querySelectorAll('[data-testid="tweetText"]'));
    for (const block of tweetTextBlocks) {
      const text = getVisibleText(block);
      if (text.length >= 30) {
        return text;
      }
    }

    return "";
  }

  function refreshXContext() {
    if (!isX) {
      return;
    }
    const current = extractXPostText();
    xPostText = current;
    if (!selectedText && current.length >= 30) {
      launcher.style.display = "inline-flex";
      launcherCount.textContent = `(${current.length} chars)`;
    }
  }

  async function analyzeSelectedText() {
    const content = selectedText || xPostText;
    if (!content) {
      setError(isX ? "Open a tweet or select text from X first." : "Select some text from a social post first.");
      return;
    }

    setError("");
    setLoading(true);
    openPanel();

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: "MILES_ANALYZE_TEXT",
            payload: {
              content: content,
              sourceUrl: location.href,
              pageTitle: document.title,
            },
          },
          (message) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(message);
          }
        );
      });

      if (!response?.success) {
        throw new Error(response?.error || "Analysis failed.");
      }

      renderResult(response.result);
    } catch (error) {
      setError(String(error?.message || error));
    } finally {
      setLoading(false);
    }
  }

  function refreshSelection() {
    const selection = window.getSelection ? window.getSelection() : null;
    const text = selection ? selection.toString().trim() : "";
    selectedText = text;
    if (text.length >= 20) {
      selectionVisible = true;
      launcher.style.display = "inline-flex";
      launcherCount.textContent = `(${text.length} chars)`;
    } else if (!panel || panel.style.display !== "block") {
      selectionVisible = false;
      launcher.style.display = "none";
      launcherCount.textContent = "";
    }
  }

  document.addEventListener("selectionchange", () => {
    window.clearTimeout(window.__milesSelectionTimer);
    window.__milesSelectionTimer = window.setTimeout(refreshSelection, 120);
  });

  if (isX) {
    refreshXContext();
    const observer = new MutationObserver(() => {
      refreshXContext();
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  }

  launcher.addEventListener("click", () => {
    openPanel();
    analyzeSelectedText();
  });

  analyzeBtn.addEventListener("click", analyzeSelectedText);
  closeBtn.addEventListener("click", () => {
    closePanel();
    if (!selectionVisible) {
      launcher.style.display = "none";
    }
  });
  toggleBtn.addEventListener("click", togglePanelBody);
  openBtn.addEventListener("click", () => {
    getServerUrl().then((serverUrl) => {
      window.open(`${serverUrl}/post?compose=1`, "_blank", "noopener,noreferrer");
    });
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Escape") {
      closePanel();
    }
  });
})();

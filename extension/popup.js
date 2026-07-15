const DEFAULT_SERVER_URL = "http://localhost:3003";

const serverUrlInput = document.getElementById("server-url");
const contentInput = document.getElementById("content");
const analyzeButton = document.getElementById("analyze");
const useSelectionButton = document.getElementById("use-selection");
const openDashboardButton = document.getElementById("open-dashboard");
const errorBox = document.getElementById("error");
const resultBox = document.getElementById("result");
const resultBody = document.getElementById("result-body");
const toggleResultButton = document.getElementById("toggle-result");
const sectorBox = document.getElementById("sector");
const scoreBox = document.getElementById("score");
const verdictBox = document.getElementById("verdict");
const summaryBox = document.getElementById("summary");
const explanationBox = document.getElementById("explanation");

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function renderResult(data) {
  const score = Number(data.credibilityScore ?? data.credibility_score ?? 0);
  const verdict = data.verdict_label || "Verified";
  const color = data.verdict_color || "#2563eb";

  resultBox.classList.remove("hidden");
  resultBody.classList.remove("hidden");
  toggleResultButton.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
  sectorBox.textContent = data.sector || "General";
  scoreBox.textContent = `${score}%`;
  scoreBox.style.color = color;
  verdictBox.textContent = verdict;
  verdictBox.style.color = color;
  summaryBox.textContent = data.summary || data.explanation || "";
  explanationBox.textContent = data.explanation || "";
}

toggleResultButton.addEventListener("click", () => {
  resultBody.classList.toggle("hidden");
  toggleResultButton.innerHTML = resultBody.classList.contains("hidden")
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>';
});

async function getActiveSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return "";
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection?.().toString().trim() || "",
  });

  return result?.result || "";
}

async function analyzeContent(content) {
  const serverUrl = String(serverUrlInput.value || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  await chrome.storage.sync.set({ serverUrl });

  const response = await fetch(`${serverUrl}/api/extension/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      sourceUrl: "popup",
      pageTitle: "Popup",
    }),
  });

  const responseText = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(responseText);
  } catch (_) {
    throw new Error(
      responseText.trim().startsWith("<")
        ? "The server returned HTML instead of JSON. Make sure the MILES server is restarted and the extension is pointing to the right URL."
        : responseText || "Analysis failed."
    );
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || payload.error || "Analysis failed.");
  }

  return payload;
}

serverUrlInput.value = DEFAULT_SERVER_URL;
chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER_URL }).then((stored) => {
  serverUrlInput.value = stored.serverUrl || DEFAULT_SERVER_URL;
});

useSelectionButton.addEventListener("click", async () => {
  clearError();
  try {
    const selection = await getActiveSelection();
    if (!selection) {
      showError("No text is selected on the current page.");
      return;
    }
    contentInput.value = selection;
  } catch (error) {
    showError(String(error?.message || error));
  }
});

analyzeButton.addEventListener("click", async () => {
  clearError();
  const content = contentInput.value.trim();
  if (!content) {
    showError("Add some text first.");
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Analyzing...";
  try {
    const result = await analyzeContent(content);
    renderResult(result);
  } catch (error) {
    showError(String(error?.message || error));
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = "Analyze";
  }
});

openDashboardButton.addEventListener("click", () => {
  const serverUrl = String(serverUrlInput.value || DEFAULT_SERVER_URL).replace(/\/+$/, "");
  chrome.tabs.create({ url: `${serverUrl}/post?compose=1` });
});

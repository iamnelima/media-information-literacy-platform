const DEFAULT_SERVER_URL = "http://localhost:3003";

async function getServerUrl() {
  const stored = await chrome.storage.sync.get({ serverUrl: DEFAULT_SERVER_URL });
  return String(stored.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");
}

async function analyzeText(payload) {
  const serverUrl = await getServerUrl();
  const response = await fetch(`${serverUrl}/api/extension/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(text || "Invalid response from MILES server.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || "Extension analysis failed.");
  }

  return data;
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(["serverUrl"]);
  if (!stored.serverUrl) {
    await chrome.storage.sync.set({ serverUrl: DEFAULT_SERVER_URL });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "MILES_ANALYZE_TEXT") {
    return false;
  }

  (async () => {
    try {
      const result = await analyzeText(message.payload || {});
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({
        success: false,
        error: String(error?.message || error),
      });
    }
  })();

  return true;
});

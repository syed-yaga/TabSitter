// TabSitter Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("🦥 TabSitter extension installed.");
  chrome.storage.local.get(["apiUrl"], (result) => {
    if (!result.apiUrl) {
      chrome.storage.local.set({ apiUrl: "http://localhost:3000" });
    }
  });
});

// Listener for tab re-opening requests from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_URL") {
    chrome.tabs.create({ url: message.url }, (newTab) => {
      sendResponse({ success: true, tabId: newTab.id });
    });
    return true;
  }
});

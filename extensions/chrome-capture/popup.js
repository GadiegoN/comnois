document.addEventListener("DOMContentLoaded", async () => {
  const endpointInput = document.getElementById("endpoint");
  const tokenInput = document.getElementById("token");
  const captureTypeSelect = document.getElementById("captureType");
  const urlInput = document.getElementById("url");
  const titleInput = document.getElementById("title");
  const noteTextInput = document.getElementById("noteText");
  const tagsInput = document.getElementById("tags");
  const saveBtn = document.getElementById("saveBtn");
  const statusBox = document.getElementById("statusBox");

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["comnoisEndpoint", "comnoisToken"], (res) => {
      if (res.comnoisEndpoint) endpointInput.value = res.comnoisEndpoint;
      if (res.comnoisToken) tokenInput.value = res.comnoisToken;
    });
  }

  if (typeof chrome !== "undefined" && chrome.tabs?.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (tab) {
        urlInput.value = tab.url || "";
        titleInput.value = tab.title || "";
      }
    });
  }

  saveBtn.addEventListener("click", async () => {
    const baseUrl = (endpointInput.value || "http://localhost:3000").replace(/\/+$/, "");
    const token = (tokenInput.value || "").trim();
    const captureType = captureTypeSelect?.value || "link";
    const targetUrl = (urlInput.value || "").trim();
    const title = (titleInput.value || "").trim();
    const noteText = (noteTextInput?.value || "").trim();
    const tags = (tagsInput.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (!token) {
      statusBox.className = "status err";
      statusBox.textContent = "Informe seu token de API (cmn_...).";
      return;
    }

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({
        comnoisEndpoint: baseUrl,
        comnoisToken: token,
      });
    }

    saveBtn.disabled = true;
    try {
      const payload =
        captureType === "note"
          ? {
              type: "note",
              title: title || "Nota Capturada pelo Navegador",
              content:
                noteText ||
                `Referência capturada de ${targetUrl}`,
              tags,
            }
          : {
              type: "link",
              url: targetUrl,
              title: title || undefined,
              summary: noteText || undefined,
              tags,
            };

      const res = await fetch(`${baseUrl}/api/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || `HTTP ${res.status}`);
      }

      statusBox.className = "status ok";
      statusBox.textContent = data.duplicateWarning
        ? `Salvo! (${data.duplicateWarning.message})`
        : "Link capturado e enviado para processamento!";
    } catch (err) {
      statusBox.className = "status err";
      statusBox.textContent = `Falha: ${err.message || "Erro de conexão"}`;
    } finally {
      saveBtn.disabled = false;
    }
  });
});


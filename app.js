const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const snapshot = document.getElementById("snapshot");
const captureBtn = document.getElementById("capture");
const analyzeBtn = document.getElementById("analyze");
const enableCameraBtn = document.getElementById("enableCamera");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLabel = resultEl.querySelector(".result-label");
const resultPill = resultEl.querySelector(".result-pill");
const modelOutput = document.getElementById("modelOutput");
const modelTitle = modelOutput.querySelector(".model-title");
const modelBrand = modelOutput.querySelectorAll(".model-meta")[0];
const modelCountry = modelOutput.querySelectorAll(".model-meta")[1];
const modelConfidence = modelOutput.querySelectorAll(".model-meta")[2];
const modelReasoning = modelOutput.querySelector(".model-reasoning");
const apiKeyInput = document.getElementById("apiKey");
const testKeyBtn = document.getElementById("testKey");
const clearKeyBtn = document.getElementById("clearKey");
const historyList = document.getElementById("historyList");
const openSetupBtn = document.getElementById("openSetup");
const closeSetupBtn = document.getElementById("closeSetup");
const setupPanel = document.getElementById("setupPanel");
const keyStatus = document.getElementById("keyStatus");

const savedKey = localStorage.getItem("openai_api_key");
if (savedKey) {
  apiKeyInput.value = savedKey;
}

const hasStoredKey = () => Boolean(apiKeyInput.value);

const updateActionButtons = () => {
  const keyReady = hasStoredKey();
  enableCameraBtn.disabled = !keyReady;
  captureBtn.disabled = !keyReady || !stream;
  analyzeBtn.disabled = !keyReady || !stream;
};

const updateKeyState = () => {
  const keyReady = hasStoredKey();
  keyStatus.textContent = keyReady ? "Key: stored" : "Key: not set";
  updateActionButtons();
  if (!keyReady) {
    setStatus("Add your API key in Setup to enable scanning.");
    enableCameraBtn.classList.add("hidden");
  } else if (!stream) {
    setStatus("Key stored. Enable the camera to begin.");
    enableCameraBtn.classList.remove("hidden");
  } else {
    enableCameraBtn.classList.add("hidden");
  }
};

apiKeyInput.addEventListener("input", () => {
  const cleaned = apiKeyInput.value.replace(/\s+/g, "");
  apiKeyInput.value = cleaned;
  if (cleaned) {
    localStorage.setItem("openai_api_key", cleaned);
  } else {
    localStorage.removeItem("openai_api_key");
  }
  updateKeyState();
});

clearKeyBtn.addEventListener("click", () => {
  apiKeyInput.value = "";
  localStorage.removeItem("openai_api_key");
  setStatus("API key cleared.");
  updateKeyState();
});

const looksLikeKey = (value) => {
  if (!value) return false;
  if (value.startsWith("Bearer")) return false;
  if (value.startsWith("{")) return false;
  return value.startsWith("sk-") || value.startsWith("sk_");
};

const testApiKey = async (apiKey) => {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
};

testKeyBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.replace(/\s+/g, "");
  if (!looksLikeKey(apiKey)) {
    setStatus("Paste a valid API key that starts with sk-.");
    return;
  }
  setStatus("Testing API key…");
  try {
    await testApiKey(apiKey);
    setStatus("Key verified and saved for this browser.");
    updateKeyState();
  } catch (error) {
    setStatus("API key test failed.");
    console.error(error);
  }
});

let stream;
const historyEntries = [];

const setStatus = (text) => {
  statusEl.textContent = text;
};

const setResult = (state, label, pill) => {
  resultEl.dataset.state = state;
  resultLabel.textContent = label;
  resultPill.textContent = pill;
};

const updateResultFromVerdict = (verdict) => {
  setResult(verdict.state, verdict.label, verdict.pill);
};

const updateModelOutput = ({
  state = "unknown",
  title = "Waiting for capture…",
  brand = "—",
  country = "—",
  confidence = "—",
  reasoning = "—",
}) => {
  modelOutput.classList.remove("state-stop", "state-up", "state-unknown", "empty");
  modelOutput.classList.add(`state-${state}`);
  modelTitle.textContent = title;
  modelBrand.textContent = `Brand: ${brand || "—"}`;
  modelCountry.textContent = `Country: ${country || "—"}`;
  modelConfidence.textContent = `Confidence: ${confidence || "—"}`;
  modelReasoning.textContent = `Reasoning: ${reasoning || "—"}`;
};

const addHistoryEntry = ({ image, title, brand, country, confidence }) => {
  historyEntries.unshift({ image, title, brand, country, confidence });
  historyList.innerHTML = "";
  historyEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const img = document.createElement("img");
    img.className = "history-thumb";
    img.src = entry.image;
    img.alt = "Captured product";

    const text = document.createElement("div");
    const heading = document.createElement("p");
    heading.className = "history-title";
    heading.textContent = entry.title;

    const brandLine = document.createElement("p");
    brandLine.className = "history-meta";
    brandLine.textContent = `Brand: ${entry.brand || "—"}`;

    const countryLine = document.createElement("p");
    countryLine.className = "history-meta";
    countryLine.textContent = `Country: ${entry.country || "—"} • Confidence: ${
      entry.confidence || "—"
    }`;

    text.appendChild(heading);
    text.appendChild(brandLine);
    text.appendChild(countryLine);

    item.appendChild(img);
    item.appendChild(text);
    historyList.appendChild(item);
  });
};

const buildPrompt = () => {
  const base =
    "Identify the product in the image, name the brand, and infer the brand's country of origin. " +
    "Answer in JSON with keys: brand, country, confidence (low|medium|high), " +
    "is_american (true|false|unknown), and reasoning (short).";
  return base;
};

const stopStream = () => {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
};

const startCamera = async () => {
  try {
    if (!window.isSecureContext) {
      setStatus("Camera needs HTTPS or localhost. Open via https:// to allow access.");
      enableCameraBtn.classList.remove("hidden");
      return;
    }
    setStatus("Requesting camera access...");
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    updateActionButtons();
    enableCameraBtn.classList.add("hidden");
    setStatus("Camera live. Capture a photo to begin.");
  } catch (error) {
    setStatus("Camera access denied. Tap Enable camera and allow permission.");
    enableCameraBtn.classList.remove("hidden");
    console.error(error);
  }
};

captureBtn.addEventListener("click", () => {
  if (!stream) return;
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  snapshot.src = canvas.toDataURL("image/jpeg", 0.92);
  snapshot.classList.remove("hidden");
  video.classList.add("hidden");
  setStatus("Captured. Ready to analyze.");
  updateResultFromVerdict({
    state: "idle",
    label: "Waiting to analyze image.",
    pill: "—",
  });
  updateModelOutput({
    state: "unknown",
    title: "Waiting for analysis…",
    brand: "—",
    country: "—",
    confidence: "—",
    reasoning: "—",
  });
});

analyzeBtn.addEventListener("click", async () => {
  if (!snapshot.src) {
    setStatus("Capture an image before analyzing.");
    return;
  }

  const apiKey = apiKeyInput.value.replace(/\s+/g, "");
  if (!apiKey) {
    setStatus("Enter your API key to analyze.");
    return;
  }
  if (!looksLikeKey(apiKey)) {
    setStatus("Paste only the raw API key (starts with sk-), not an error message.");
    return;
  }

  setStatus("Analyzing the product…");
  setResult("idle", "Analyzing image…", "Working");
  updateModelOutput({
    state: "unknown",
    title: "Analyzing image…",
    brand: "—",
    country: "—",
    confidence: "—",
    reasoning: "Working…",
  });

  try {
    const body = {
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt() },
            { type: "image_url", image_url: { url: snapshot.src } },
          ],
        },
      ],
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      parsed = null;
    }

    const isAmerican = parsed?.is_american;
    const brand = parsed?.brand || "Unknown";
    const country = parsed?.country || "Unknown";
    const confidence = parsed?.confidence || "Unknown";
    const reasoning = parsed?.reasoning || "No reasoning provided.";
    const verdict =
      isAmerican === true
        ? { state: "yes", label: `Brand likely American (${country}).`, pill: "USA" }
        : isAmerican === false
          ? { state: "no", label: `Brand likely from ${country}.`, pill: "Not USA" }
          : { state: "idle", label: "Origin unclear from image.", pill: "Unknown" };

    updateResultFromVerdict(verdict);
    updateModelOutput({
      state: isAmerican === true ? "stop" : isAmerican === false ? "up" : "unknown",
      title:
        isAmerican === true
          ? "American brand detected"
          : isAmerican === false
            ? "Non-American brand detected"
            : "Origin unclear",
      brand,
      country,
      confidence,
      reasoning,
    });
    addHistoryEntry({
      image: snapshot.src,
      title: verdict.label,
      brand,
      country,
      confidence,
    });
    setStatus("Analysis complete.");
  } catch (error) {
    setStatus("Analysis failed. Check your API key and try again.");
    updateModelOutput({
      state: "unknown",
      title: "Request failed.",
      brand: "—",
      country: "—",
      confidence: "—",
      reasoning: "Check your API key and plan.",
    });
    setResult("idle", "Request failed.", "Error");
    console.error(error);
  }
});

const openSetup = () => {
  setupPanel.classList.remove("hidden");
  apiKeyInput.focus();
};

const closeSetup = () => {
  setupPanel.classList.add("hidden");
};

openSetupBtn.addEventListener("click", openSetup);
closeSetupBtn.addEventListener("click", closeSetup);
setupPanel.addEventListener("click", (event) => {
  if (!event.target.closest(".setup-card")) {
    closeSetup();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !setupPanel.classList.contains("hidden")) {
    closeSetup();
  }
});

window.addEventListener("beforeunload", stopStream);
window.addEventListener("load", () => {
  updateKeyState();
  if (hasStoredKey()) {
    startCamera();
  }
});
enableCameraBtn.addEventListener("click", startCamera);

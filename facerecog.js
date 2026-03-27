const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const emotionText = document.getElementById("emotion");
const statusText = document.getElementById("status");

const MODEL_PATH = "./models";
const detectorOptions = () =>
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.2,
  });

let detectionLoop = null;

function setStatus(message) {
  statusText.textContent = message;
}

function setEmotion(message) {
  emotionText.textContent = message;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTopEmotion(expressions) {
  return Object.entries(expressions).reduce((top, current) =>
    current[1] > top[1] ? current : top
  );
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

async function loadModels() {
  if (window.location.protocol === "file:") {
    throw new Error("Open this app through http://localhost, not file://, so the local models can load.");
  }

  if (typeof faceapi === "undefined") {
    throw new Error("face-api.js did not load. Check your internet connection for the library script.");
  }

  setStatus("Loading local AI models...");
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
    faceapi.nets.faceExpressionNet.loadFromUri("./models"),
  ]);

  return MODEL_PATH;
}

function syncCanvasSize() {
  const rect = video.getBoundingClientRect();
  overlay.width = rect.width;
  overlay.height = rect.height;
}

async function detectFrame() {
  if (video.readyState < 2) {
    return;
  }

  const detection = await faceapi
    .detectSingleFace(video, detectorOptions())
    .withFaceExpressions();

  const displaySize = { width: overlay.width, height: overlay.height };
  const resized = detection ? faceapi.resizeResults(detection, displaySize) : null;
  const context = overlay.getContext("2d");

  context.clearRect(0, 0, overlay.width, overlay.height);

  if (!resized) {
    setStatus("Camera is live. No face detected.");
    setEmotion("Waiting for a face in frame...");
    return;
  }

  const [emotion, score] = getTopEmotion(resized.expressions);
  const label = `${capitalize(emotion)} ${Math.round(score * 100)}%`;

  faceapi.matchDimensions(overlay, displaySize);
  faceapi.draw.drawDetections(overlay, resized);
  new faceapi.draw.DrawTextField(
    [label],
    resized.detection.box.bottomLeft
  ).draw(overlay);

  setStatus("Camera is live. Face detected.");
  setEmotion(`Emotion: ${capitalize(emotion)} (${Math.round(score * 100)}%)`);
}

async function initialize() {
  try {
    setStatus("Opening camera...");
    await startCamera();

    const source = await loadModels();
    syncCanvasSize();
    setStatus(`Camera is live. Models ready from ${source}.`);
    setEmotion("Scanning emotion...");

    window.addEventListener("resize", syncCanvasSize);
    video.addEventListener("loadeddata", syncCanvasSize);
    video.addEventListener("playing", () => {
      setStatus("Camera is live. Scanning for a face...");
    });

    detectionLoop = window.setInterval(async () => {
      try {
        await detectFrame();
      } catch (error) {
        setStatus("Detection paused due to an internal error.");
        setEmotion(error.message || "Detection error");
        console.error(error);
      }
    }, 250);
  } catch (error) {
    console.error(error);
    setStatus("Unable to start the camera or load models.");
    setEmotion(error.message);
  }
}

window.addEventListener("beforeunload", () => {
  if (detectionLoop) {
    clearInterval(detectionLoop);
  }

  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }
});

initialize();

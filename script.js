const scene = document.getElementById("scene");
const tempEl = document.getElementById("temp");
const cityEl = document.getElementById("city");
const metaEl = document.getElementById("meta");
const form = document.getElementById("search");
const input = document.getElementById("cityInput");
const windowEl = document.querySelector(".window");
const soundToggle = document.getElementById("soundToggle");

let audioCtx = null;
let noiseSource = null;
let masterGain = null;
let rainGain = null;
let windGain = null;
let rainFilter = null;
let windFilter = null;
let soundEnabled = false;
let suspendTimer = null;
let currentSound = { condition: "clear", wind: 0 };

const createNoiseSource = (context) => {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
};

const initAudio = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  audioCtx = new AudioContext();
  noiseSource = createNoiseSource(audioCtx);

  rainFilter = audioCtx.createBiquadFilter();
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = 1200;
  rainFilter.Q.value = 0.7;

  windFilter = audioCtx.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.6;

  rainGain = audioCtx.createGain();
  windGain = audioCtx.createGain();
  masterGain = audioCtx.createGain();

  rainGain.gain.value = 0;
  windGain.gain.value = 0;
  masterGain.gain.value = 0;

  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = "sine";
  lfo.frequency.value = 0.18;
  lfoGain.gain.value = 240;
  lfo.connect(lfoGain);
  lfoGain.connect(rainFilter.frequency);

  noiseSource.connect(rainFilter);
  rainFilter.connect(rainGain);
  rainGain.connect(masterGain);

  noiseSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(masterGain);

  masterGain.connect(audioCtx.destination);

  noiseSource.start();
  lfo.start();
};

const updateSound = ({ condition, wind }) => {
  if (!audioCtx || !rainGain || !windGain) return;
  const rainOn = condition === "rain" || condition === "thunder";
  const windLevel = Number.isFinite(wind) ? clamp(wind / 30, 0, 1) : 0;
  const rainTarget = rainOn ? 0.12 : 0;
  const windTarget = windLevel * 0.08 + (rainOn ? 0.02 : 0);
  rainGain.gain.setTargetAtTime(rainTarget, audioCtx.currentTime, 0.8);
  windGain.gain.setTargetAtTime(windTarget, audioCtx.currentTime, 1);
};

const setSoundEnabled = async (enabled) => {
  if (!soundToggle) return;
  if (enabled) {
    if (suspendTimer) {
      clearTimeout(suspendTimer);
      suspendTimer = null;
    }
    if (!audioCtx) {
      initAudio();
    }
    if (audioCtx && audioCtx.state !== "running") {
      await audioCtx.resume();
    }
    soundEnabled = true;
    windowEl.classList.add("sound-on");
    soundToggle.setAttribute("aria-pressed", "true");
    soundToggle.textContent = "sound on";
    if (masterGain) {
      masterGain.gain.setTargetAtTime(0.09, audioCtx.currentTime, 0.4);
    }
    updateSound(currentSound);
  } else {
    soundEnabled = false;
    windowEl.classList.remove("sound-on");
    soundToggle.setAttribute("aria-pressed", "false");
    soundToggle.textContent = "sound";
    if (audioCtx && masterGain) {
      masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
      suspendTimer = setTimeout(() => {
        audioCtx.suspend();
      }, 350);
    }
  }
};


const parallaxSurface = document.querySelector(".window");
let parallaxFrame = null;
let parallaxX = 0;
let parallaxY = 0;
let targetX = 0;
let targetY = 0;

const animateParallax = () => {
  parallaxX += (targetX - parallaxX) * 0.08;
  parallaxY += (targetY - parallaxY) * 0.08;
  scene.style.setProperty("--px", `${parallaxX.toFixed(2)}px`);
  scene.style.setProperty("--py", `${parallaxY.toFixed(2)}px`);
  if (Math.abs(targetX - parallaxX) < 0.02 && Math.abs(targetY - parallaxY) < 0.02) {
    parallaxX = targetX;
    parallaxY = targetY;
    scene.style.setProperty("--px", `${parallaxX.toFixed(2)}px`);
    scene.style.setProperty("--py", `${parallaxY.toFixed(2)}px`);
    parallaxFrame = null;
    return;
  }
  parallaxFrame = requestAnimationFrame(animateParallax);
};

const queueParallax = () => {
  if (!parallaxFrame) {
    parallaxFrame = requestAnimationFrame(animateParallax);
  }
};

parallaxSurface.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  const rect = scene.getBoundingClientRect();
  const relX = (event.clientX - rect.left) / rect.width - 0.5;
  const relY = (event.clientY - rect.top) / rect.height - 0.5;
  targetX = relX * 18;
  targetY = relY * 14;
  queueParallax();
});

parallaxSurface.addEventListener("pointerleave", () => {
  targetX = 0;
  targetY = 0;
  queueParallax();
});

const DEFAULT_CITY = "New York";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const weatherMap = (code) => {
  if (code === 0) return "clear";
  if ([1, 2, 3].includes(code)) return "clouds";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "thunder";
  return "clear";
};

const setLoading = (value) => {
  windowEl.classList.toggle("loading", value);
};

const setError = () => {
  windowEl.classList.add("error");
  setTimeout(() => windowEl.classList.remove("error"), 1200);
};

const updateScene = ({ temperature, code, isDay, city, feels, wind, humidity }) => {
  const condition = weatherMap(code);
  scene.dataset.condition = condition;
  scene.dataset.day = isDay ? "true" : "false";
  const round = (value) => (Number.isFinite(value) ? Math.round(value) : "--");
  const humidityLevel = Number.isFinite(humidity) ? clamp((humidity - 55) / 40, 0, 1) : 0;
  const rainBoost = condition === "rain" || condition === "thunder" ? 0.12 : 0;
  const mistOpacity = clamp(0.05 + humidityLevel * 0.35 + rainBoost, 0, 0.7).toFixed(2);
  const mistBlur = (humidityLevel * 8 + (rainBoost > 0 ? 2 : 0)).toFixed(1);
  const windLevel = Number.isFinite(wind) ? clamp(wind / 30, 0, 1) : 0;
  const flagTilt = (-16 + windLevel * 16).toFixed(1);
  const flagSway = (2 + windLevel * 6).toFixed(1);
  const flagStretch = (0.7 + windLevel * 0.45).toFixed(2);
  const flagSpeed = (4.6 - windLevel * 2.2).toFixed(2);
  scene.style.setProperty("--mist-opacity", mistOpacity);
  scene.style.setProperty("--mist-blur", `${mistBlur}px`);
  scene.style.setProperty("--flag-tilt", flagTilt);
  scene.style.setProperty("--flag-sway", flagSway);
  scene.style.setProperty("--flag-stretch", flagStretch);
  scene.style.setProperty("--flag-speed", `${flagSpeed}s`);
  tempEl.textContent = `${round(temperature)}°`;
  cityEl.textContent = city ? city.toUpperCase() : "";
  metaEl.textContent = `Feels ${round(feels)}° • Wind ${round(wind)} km/h • Humidity ${round(humidity)}%`;
  currentSound = { condition, wind: Number.isFinite(wind) ? wind : 0 };
  if (soundEnabled) {
    updateSound(currentSound);
  }
};

const fetchCity = async (name) => {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    name
  )}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("city");
  const data = await res.json();
  if (!data.results || !data.results.length) throw new Error("city");
  return data.results[0];
};

const fetchWeather = async (lat, lon) => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather");
  const data = await res.json();
  if (data.current) {
    return {
      temperature: data.current.temperature_2m,
      feels: data.current.apparent_temperature,
      wind: data.current.wind_speed_10m,
      humidity: data.current.relative_humidity_2m,
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
    };
  }
  if (data.current_weather) {
    return {
      temperature: data.current_weather.temperature,
      feels: data.current_weather.temperature,
      wind: data.current_weather.windspeed,
      humidity: null,
      code: data.current_weather.weathercode,
      isDay: data.current_weather.is_day === 1,
    };
  }
  throw new Error("weather");
};

const loadWeather = async (name) => {
  setLoading(true);
  try {
    const city = await fetchCity(name);
    const weather = await fetchWeather(city.latitude, city.longitude);
    updateScene({
      ...weather,
      city: `${city.name}${city.country_code ? `, ${city.country_code}` : ""}`,
    });
    localStorage.setItem("weatherCity", city.name);
  } catch (err) {
    setError();
  } finally {
    setLoading(false);
  }
};

if (soundToggle) {
  soundToggle.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  loadWeather(value);
  input.blur();
});

const boot = () => {
  const saved = localStorage.getItem("weatherCity") || DEFAULT_CITY;
  input.value = "";
  loadWeather(saved);
};

boot();

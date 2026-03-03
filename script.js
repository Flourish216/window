const scene = document.getElementById("scene");
const tempEl = document.getElementById("temp");
const cityEl = document.getElementById("city");
const form = document.getElementById("search");
const input = document.getElementById("cityInput");
const windowEl = document.querySelector(".window");

const DEFAULT_CITY = "New York";

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

const updateScene = ({ temperature, code, isDay, city }) => {
  const condition = weatherMap(code);
  scene.dataset.condition = condition;
  scene.dataset.day = isDay ? "true" : "false";
  tempEl.textContent = `${Math.round(temperature)}°`;
  cityEl.textContent = city ? city.toUpperCase() : "";
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
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather");
  const data = await res.json();
  if (data.current) {
    return {
      temperature: data.current.temperature_2m,
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
    };
  }
  if (data.current_weather) {
    return {
      temperature: data.current_weather.temperature,
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

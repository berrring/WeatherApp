let unit = 'metric'; // 'metric' for °C, 'imperial' for °F
let currentTempUnit = 'C';
let currentTab = 'today';
let currentCity = 'Burdwan'; // Город по умолчанию
let cityOffsetSeconds = 0; // Храним смещение времени города

const WEATHER_CODES = {
    0: { text: "Ясно", emoji: "☀️" },
    1: { text: "Преим. ясно", emoji: "🌤️" },
    2: { text: "Переменная", emoji: "⛅" },
    3: { text: "Пасмурно", emoji: "☁️" },
    45: { text: "Туман", emoji: "🌫️" },
    48: { text: "Изморозь", emoji: "🌫️" },
    51: { text: "Морось", emoji: "🌦️" },
    53: { text: "Морось", emoji: "🌦️" },
    55: { text: "Сильная морось", emoji: "🌧️" },
    61: { text: "Дождь", emoji: "🌦️" },
    63: { text: "Дождь", emoji: "🌧️" },
    65: { text: "Ливень", emoji: "🌧️" },
    71: { text: "Снег", emoji: "🌨️" },
    73: { text: "Снегопад", emoji: "❄️" },
    75: { text: "Сильный снег", emoji: "❄️" },
    80: { text: "Ливень", emoji: "🌧️" },
    95: { text: "Гроза", emoji: "⛈️" },
};

function getWeatherIcon(code) {
    return WEATHER_CODES[code]?.emoji || '🌤️';
}

// Функция для расчета местного времени города
function getCityTime(offsetSeconds) {
    const now = new Date();
    // Получаем UTC время в миллисекундах
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    // Прибавляем смещение города (секунды * 1000)
    const cityTime = new Date(utcTime + (offsetSeconds * 1000));
    return cityTime;
}

function updateClock() {
    // Обновляем часы каждую минуту, используя сохраненное смещение
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        const cityDate = getCityTime(cityOffsetSeconds);
        timeElement.textContent = cityDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: 'numeric', 
            hour12: true 
        }).toLowerCase();
    }
}

// Запускаем обновление часов каждую секунду
setInterval(updateClock, 1000);


function toggleTemp(newUnit) {
    currentTempUnit = newUnit;
    unit = newUnit === 'C' ? 'metric' : 'imperial';
    
    document.querySelectorAll('.unit-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.unit-btn'))
                           .find(b => b.textContent.includes(newUnit));
    if(activeBtn) activeBtn.classList.add('active');
    
    fetchWeather(currentCity);
}

async function fetchWeather(city) {
    const tempElement = document.getElementById('temperature');
    tempElement.textContent = '--'; 

    try {
        // 1. Геокодинг
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`);
        const geoData = await geoRes.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('City not found');
        }

        const place = geoData.results[0];
        const lat = place.latitude;
        const lon = place.longitude;
        currentCity = place.name;

        const tempUnit = (unit === 'metric') ? 'celsius' : 'fahrenheit';
        const windUnit = (unit === 'metric') ? 'kmh' : 'mph';

        // 2. Запрос погоды
        // Добавляем pressure_msl в hourly, чтобы достать давление для "Завтра"
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,pressure_msl,weather_code&hourly=temperature_2m,weather_code,visibility,pressure_msl,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`);
        const weatherData = await weatherRes.json();

        // Сохраняем смещение времени для города
        cityOffsetSeconds = weatherData.utc_offset_seconds;
        updateClock(); // Сразу обновляем время

        const current = weatherData.current;
        const hourly = weatherData.hourly;
        const daily = weatherData.daily;

        const currentVisibility = hourly.visibility[0] ? (hourly.visibility[0] / 1000).toFixed(1) + 'km' : 'N/A';

        if (currentTab === 'today') {
            updateToday(current, hourly, place, currentVisibility);
        } else if (currentTab === 'tomorrow') {
            updateTomorrow(daily, hourly, place);
        } else if (currentTab === 'monthly') {
            updateMonthly(daily, place);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Город не найден. Попробуйте ввести название на английском.');
    }
}

function updateToday(current, hourly, place, visibility) {
    document.getElementById('location').textContent = place.name;
    document.getElementById('temperature').textContent = Math.round(current.temperature_2m) + (unit === 'metric' ? '°C' : '°F');
    document.getElementById('weather-icon').textContent = getWeatherIcon(current.weather_code);
    
    const date = getCityTime(cityOffsetSeconds); // Используем время города
    const options = { month: 'short', day: 'numeric', weekday: 'short' };
    document.getElementById('date').textContent = date.toLocaleDateString('en-US', options);

    document.getElementById('humidity').textContent = current.relative_humidity_2m + '%';
    document.getElementById('visibility').textContent = visibility;
    document.getElementById('pressure').textContent = current.pressure_msl + 'hPa';
    document.getElementById('wind').textContent = current.wind_speed_10m + (unit === 'metric' ? 'km/h' : 'mph');

    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';

    // Для Today показываем почасовой прогноз, начиная с текущего часа ГОРОДА
    const currentCityHour = getCityTime(cityOffsetSeconds).getHours();
    let count = 0;

    for (let i = 0; i < 24; i++) {
        // hourly.time приходит в ISO формате локального времени запрошенного места
        const timeStr = hourly.time[i];
        const itemHour = new Date(timeStr).getHours();
        
        if (count >= 7) break; 

        // Показываем ближайшие часы. 
        // (Простая логика: берем индексы, совпадающие с текущим часом и дальше)
        if (i >= currentCityHour || (currentCityHour > 20 && i < 5)) { 
             // Тут упрощение: OpenMeteo hourly[0] = 00:00 сегодня.
             // Нам нужно найти индекс соответствующий текущему часу.
             // Но для простоты вывода просто возьмем срез:
        }
    }
    
    // Более надежный вывод почасового прогноза
    // Находим индекс текущего часа
    const nowISO = hourly.time.find(t => new Date(t).getHours() === currentCityHour);
    const startIndex = hourly.time.indexOf(nowISO);
    
    if (startIndex !== -1) {
        for (let i = startIndex; i < startIndex + 8; i++) {
            if (!hourly.time[i]) break;
            
            const dateObj = new Date(hourly.time[i]);
            const hourText = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
            const temp = Math.round(hourly.temperature_2m[i]) + '°';
            const icon = getWeatherIcon(hourly.weather_code[i]);

            const div = document.createElement('div');
            div.className = 'hourly-item';
            div.innerHTML = `
                <div class="hourly-time">${hourText.toLowerCase()}</div>
                <div class="hourly-icon">${icon}</div>
                <div class="hourly-temp">${temp}</div>
            `;
            hourlyContainer.appendChild(div);
        }
    }
}

function updateTomorrow(daily, hourly, place) {
    document.getElementById('location').textContent = place.name;
    document.getElementById('date').textContent = "Tomorrow";
    
    const maxTemp = Math.round(daily.temperature_2m_max[1]);
    const minTemp = Math.round(daily.temperature_2m_min[1]);
    
    // Температура: Макс / Мин
    document.getElementById('temperature').textContent = `${maxTemp}°`;
    document.getElementById('weather-icon').textContent = getWeatherIcon(daily.weather_code[1]);
    
    // --- ИСПРАВЛЕНИЕ ПУСТЫХ ПОЛЕЙ ---
    // Мы берем данные на 12:00 (полдень) ЗАВТРАШНЕГО ДНЯ, чтобы заполнить детали
    // Индекс 36 в массиве hourly соответствует 12:00 завтрашнего дня (24 часа сегодня + 12 часов завтра)
    const noonIndex = 36; 
    
    if (hourly.time[noonIndex]) {
        const humidity = hourly.relative_humidity_2m[noonIndex];
        const visibility = (hourly.visibility[noonIndex] / 1000).toFixed(1);
        const pressure = hourly.pressure_msl[noonIndex];
        const wind = hourly.wind_speed_10m[noonIndex];

        document.getElementById('humidity').textContent = humidity + '%';
        document.getElementById('visibility').textContent = visibility + 'km';
        document.getElementById('pressure').textContent = pressure + 'hPa';
        document.getElementById('wind').textContent = wind + (unit === 'metric' ? 'km/h' : 'mph');
    } else {
        // Если вдруг данных нет
        document.getElementById('humidity').textContent = '--';
    }
    
    // Очищаем нижний блок, так как это прогноз на завтра (или можно показать прогноз по часам на завтра)
    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '<div style="padding:10px; color:#aaa;">Прогноз на весь день</div>';
}

function updateMonthly(daily, place) {
    document.getElementById('location').textContent = place.name;
    document.getElementById('temperature').textContent = "Week";
    document.getElementById('weather-icon').textContent = "📅";
    document.getElementById('date').textContent = "7 Days Forecast";

    // Скрываем детали для недели, они не особо нужны
    document.getElementById('humidity').textContent = '--';
    document.getElementById('visibility').textContent = '--';
    document.getElementById('pressure').textContent = '--';
    document.getElementById('wind').textContent = '--';

    const hourlyContainer = document.getElementById('hourly-forecast');
    hourlyContainer.innerHTML = '';

    for (let i = 0; i < daily.time.length; i++) {
        const dateObj = new Date(daily.time[i]);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const temp = Math.round(daily.temperature_2m_max[i]) + '°';
        const icon = getWeatherIcon(daily.weather_code[i]);

        const div = document.createElement('div');
        div.className = 'hourly-item';
        div.innerHTML = `
            <div class="hourly-time">${dayName}</div>
            <div class="hourly-icon">${icon}</div>
            <div class="hourly-temp">${temp}</div>
        `;
        hourlyContainer.appendChild(div);
    }
}

// Event Listeners
document.getElementById('location-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = e.target.value.trim();
        if (city) fetchWeather(city);
    }
});

document.getElementById('search-btn').addEventListener('click', () => {
    const city = document.getElementById('location-search').value.trim();
    if (city) fetchWeather(city);
});

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const text = tab.textContent.trim();
        if(text === 'Today') currentTab = 'today';
        else if(text === 'Tomorrow') currentTab = 'tomorrow';
        else currentTab = 'monthly';
        
        fetchWeather(currentCity);
    });
});

// Init
fetchWeather(currentCity);
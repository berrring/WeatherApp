let currentCity = "Sarajevo";
let currentUnit = "C";
let activeTab = "today";
let cityTimezone = "Europe/Sarajevo"; // Начальный для Лондона

const weatherIcons = {
    0: "☀️", 1: "🌤", 2: "⛅", 3: "☁️",
    45: "🌫", 48: "🌫",
    51: "🌦", 53: "🌦", 55: "🌧",
    61: "🌧", 63: "🌧", 65: "🌧",
    71: "🌨", 73: "❄️", 75: "❄️",
    80: "🌦", 81: "🌧", 82: "🌧",
    95: "⛈", 96: "⛈", 99: "⛈"
};

function getIcon(code) {
    return weatherIcons[code] || "🌥";
}

// Формат времени для карусели из строки API (локальное время города)
function formatCustomTimeFromLocalString(timeStr) {
    const hours24 = parseInt(timeStr.split('T')[1].split(':')[0]);
    const minutes = timeStr.split(':')[1];
    const ampm = hours24 >= 12 ? 'pm' : 'am';
    let displayHour;
    if (ampm === 'am') {
        displayHour = hours24 === 0 ? 12 : hours24;
    } else {
        displayHour = hours24.toString().padStart(2, '0');
    }
    return `${displayHour}:${minutes}${ampm}`;
}

// Формат времени для заголовка (живое время города)
function formatCustomCityTime(timezone) {
    const now = new Date();
    const options = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const hoursStr = parts.find(p => p.type === 'hour').value;
    const minutesStr = parts.find(p => p.type === 'minute').value.padStart(2, '0');
    const hours24 = parseInt(hoursStr);
    const ampm = hours24 >= 12 ? 'pm' : 'am';
    let displayHour;
    if (ampm === 'am') {
        displayHour = hours24 === 0 ? 12 : hours24;
    } else {
        displayHour = hours24.toString().padStart(2, '0');
    }
    return `${displayHour}:${minutesStr}${ampm}`;
}

function updateClock() {
    document.getElementById('current-time').innerText = formatCustomCityTime(cityTimezone);
}
setInterval(updateClock, 1000);
updateClock();

// Переключатель единиц
const unitSwitch = document.getElementById('unit-switch');
unitSwitch.addEventListener('click', function () {
    const isC = this.classList.contains('c-active');
    if (isC) {
        this.classList.remove('c-active');
        this.classList.add('imperial');
        currentUnit = "F";
    } else {
        this.classList.remove('imperial');
        this.classList.add('c-active');
        currentUnit = "C";
    }
    getWeather(currentCity);
});

// Поиск
document.getElementById('city-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (val) getWeather(val);
    }
});

// Табы
function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        const txt = btn.innerText.toLowerCase();
        if ((tabName === 'today' && txt === 'today') ||
            (tabName === 'tomorrow' && txt === 'tomorrow') ||
            (tabName === 'weekly' && txt.includes('weekly'))) {
            btn.classList.add('active');
        }
    });
    getWeather(currentCity);
}

// API
async function getWeather(city) {
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results) {
            alert("City not found");
            return;
        }

        const { latitude, longitude, name } = geoData.results[0];
        currentCity = name;
        document.getElementById('city-name').innerText = name;

        const unitParam = currentUnit === 'C' ? 'celsius' : 'fahrenheit';
        const speedParam = currentUnit === 'C' ? 'kmh' : 'mph';

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,pressure_msl,wind_speed_10m,visibility&hourly=temperature_2m,weather_code,pressure_msl,visibility,relative_humidity_2m,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${unitParam}&wind_speed_unit=${speedParam}`;

        const res = await fetch(weatherUrl);
        const data = await res.json();

        // Обновляем часовой пояс города
        cityTimezone = data.timezone;
        updateClock(); // Немедленное обновление времени

        updateMainCard(data);
        updateCarousel(data);

    } catch (e) {
        console.error(e);
    }
}

function updateMainCard(data) {
    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    // Дата
    const dateObj = new Date();
    if (activeTab === 'tomorrow') dateObj.setDate(dateObj.getDate() + 1);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    document.getElementById('date-text').innerText = dateStr;

    const tempSym = currentUnit === 'C' ? '°C' : '°F';
    const speedSym = currentUnit === 'C' ? 'km/h' : 'mph';
    const visUnit = currentUnit === 'C' ? 'km' : 'mi';
    const visConv = currentUnit === 'C' ? 1000 : 1609.34;

    // Индекс текущего часа
    let currentIndex = hourly.time.indexOf(current.time);
    if (currentIndex === -1) currentIndex = 0;

    let temp, icon, humidity = '--', visibility = '--', pressure = '--', wind = '--';

    if (activeTab === 'tomorrow') {
        const dayIdx = 1;
        const max = Math.round(daily.temperature_2m_max[dayIdx]);
        temp = `${max}${tempSym}`;
        icon = getIcon(daily.weather_code[dayIdx]);

        const forecastIdx = currentIndex + 24;
        if (forecastIdx < hourly.time.length) {
            humidity = hourly.relative_humidity_2m[forecastIdx] + '%';
            visibility = (hourly.visibility[forecastIdx] / visConv).toFixed(1) + visUnit;
            pressure = Math.round(hourly.pressure_msl[forecastIdx]) + 'hPa';
            wind = Math.round(hourly.wind_speed_10m[forecastIdx]) + speedSym;
        }
    } else {
        temp = Math.round(current.temperature_2m) + tempSym;
        icon = getIcon(current.weather_code);
        humidity = current.relative_humidity_2m + '%';
        visibility = (current.visibility / visConv).toFixed(1) + visUnit;
        pressure = Math.round(current.pressure_msl) + 'hPa';
        wind = Math.round(current.wind_speed_10m) + speedSym;
    }

    document.getElementById('main-temp').innerText = temp;
    document.getElementById('main-icon').innerText = icon;
    document.getElementById('humidity').innerText = humidity;
    document.getElementById('visibility').innerText = visibility;
    document.getElementById('pressure').innerText = pressure;
    document.getElementById('wind').innerText = wind;
}

function updateCarousel(data) {
    const container = document.getElementById('forecast-container');
    container.innerHTML = '';

    const hourly = data.hourly;
    const daily = data.daily;

    // Правильный расчёт currentIndex: находим ближайший полный час >= current.time
    const currentTimeStr = data.current.time;
    const currentDateStr = currentTimeStr.split('T')[0];
    const currentHourMin = currentTimeStr.split('T')[1];
    const currentHour = parseInt(currentHourMin.split(':')[0]);
    const currentMin = parseInt(currentHourMin.split(':')[1]);

    // Если минуты >0, начинаем с next hour
    let startHour = (currentMin > 0) ? currentHour + 1 : currentHour;
    if (startHour > 23) {
        startHour = 0;
        // Но для today не переходим на next day
    }

    // Находим индекс для start time
    let currentIndex = -1;
    for (let i = 0; i < hourly.time.length; i++) {
        if (hourly.time[i] >= `${currentDateStr}T${startHour.toString().padStart(2, '0')}:00`) {
            currentIndex = i;
            break;
        }
    }
    if (currentIndex === -1) currentIndex = 0; // Fallback

    const tempSym = currentUnit === 'C' ? '°C' : '°F';

    if (activeTab === 'weekly') {
        for (let i = 0; i < 7; i++) {
            const d = new Date(daily.time[i]);
            let header = d.toLocaleDateString('en-US', { weekday: 'long' });
            if (i === 0) header = 'Today';
            if (i === 1) header = 'Tomorrow';

            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);
            const icon = getIcon(daily.weather_code[i]);

            addCard(container, header, icon, `${max}${tempSym} / ${min}${tempSym}`);
        }
    } else if (activeTab === 'today') {
        // Hours left from startHour to 23
        const hoursLeft = 23 - startHour;
        let startIdx = currentIndex;
        for (let k = 0; k <= hoursLeft; k++) {
            let i = startIdx + k;
            if (i >= hourly.time.length) break;

            const timeStr = formatCustomTimeFromLocalString(hourly.time[i]);
            const temp = Math.round(hourly.temperature_2m[i]) + tempSym;
            const icon = getIcon(hourly.weather_code[i]);

            addCard(container, timeStr, icon, temp);
        }
    } else if (activeTab === 'tomorrow') {
        // Аналогично, парсим current_hour из строки
        const currentTimeStr = data.current.time;
        const currentHour = parseInt(currentTimeStr.split('T')[1].split(':')[0]);
        let startIdx = currentIndex + 24 - currentHour;
        for (let k = 0; k < 24; k++) {
            let i = startIdx + k;
            if (i >= hourly.time.length) break;

            const timeStr = formatCustomTimeFromLocalString(hourly.time[i]);
            const temp = Math.round(hourly.temperature_2m[i]) + tempSym;
            const icon = getIcon(hourly.weather_code[i]);

            addCard(container, timeStr, icon, temp);
        }
    }

    container.scrollLeft = 0;
}

function addCard(container, header, icon, bodyText) {
    const card = document.createElement('div');
    card.className = 'forecast-item';
    card.innerHTML = `
        <div class="f-header">${header}</div>
        <div class="f-body">
            <div class="f-icon">${icon}</div>
            <div class="f-temp">${bodyText}</div>
        </div>
    `;
    container.appendChild(card);
}

getWeather(currentCity);
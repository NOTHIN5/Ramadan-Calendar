document.addEventListener('DOMContentLoaded', () => {
    // Determine if adhan is loaded
    if (typeof adhan === 'undefined') {
        console.error('Adhan library failed to load.');
        return;
    }

    // Coordinates for 8 divisions mapping
    const divisions = {
        dhaka: new adhan.Coordinates(23.8103, 90.4125),
        chattogram: new adhan.Coordinates(22.3569, 91.7832),
        rajshahi: new adhan.Coordinates(24.3636, 88.6241),
        khulna: new adhan.Coordinates(22.8456, 89.5403),
        barishal: new adhan.Coordinates(22.7010, 90.3535),
        sylhet: new adhan.Coordinates(24.8949, 91.8687),
        rangpur: new adhan.Coordinates(25.7439, 89.2752),
        mymensingh: new adhan.Coordinates(24.7471, 90.4203)
    };

    // Use Karachi method standard for South Asia (Bangladesh / India / Pakistan)
    const params = adhan.CalculationMethod.Karachi();

    // Safety for high latitude issues
    params.highLatitudeRule = adhan.HighLatitudeRule.TwilightAngle;

    // Adjustments for Bangladesh local standards (adding safety minutes)
    params.adjustments.fajr = -1;
    params.adjustments.maghrib = 1;

    // Elements
    const divisionSelect = document.getElementById('division-select');
    const hijriDateEl = document.getElementById('hijri-date');
    const gregorianDateEl = document.getElementById('gregorian-date');
    const nextEventTitle = document.getElementById('next-event-title');

    const hEl = document.getElementById('hours');
    const mEl = document.getElementById('minutes');
    const sEl = document.getElementById('seconds');

    const todaySehriEl = document.getElementById('today-sehri');
    const todayIftarEl = document.getElementById('today-iftar');

    const monthNameEl = document.getElementById('month-name');
    const scheduleBody = document.getElementById('schedule-body');

    let countdownInterval;

    // Initialize application
    async function init() {
        updateDates();

        // Auto-detect location based on IP
        await autoDetectLocation();

        updateDisplay();

        divisionSelect.addEventListener('change', () => {
            updateDisplay();
        });
    }

    async function autoDetectLocation() {
        try {
            let data = null;

            try {
                // Primary: geojs
                const res1 = await fetch('https://get.geojs.io/v1/ip/geo.json');
                if (res1.ok) data = await res1.json();
            } catch (e1) {
                console.log('geojs blocked, trying ipwhois');
            }

            if (!data) {
                try {
                    // Secondary: ipwho.is
                    const res2 = await fetch('https://ipwho.is/');
                    if (res2.ok) data = await res2.json();
                } catch (e2) {
                    console.log('ipwho.is blocked, trying ipapi');
                }
            }

            if (!data) {
                try {
                    // Tertiary: ipapi
                    const res3 = await fetch('https://ipapi.co/json/');
                    if (res3.ok) data = await res3.json();
                } catch (e3) {
                    throw new Error("All IP geo services blocked.");
                }
            }

            // Both geojs and ipapi return latitude/longitude directly. ipwho.is handles similarly.
            const lat = data.latitude;
            const lon = data.longitude;

            if (lat && lon) {
                const userLat = parseFloat(lat);
                const userLon = parseFloat(lon);

                let nearestDivision = 'dhaka';
                let shortestDistance = Infinity;

                for (const [divName, coords] of Object.entries(divisions)) {
                    const dLat = coords.latitude - userLat;
                    const dLon = coords.longitude - userLon;
                    const distance = dLat * dLat + dLon * dLon;

                    if (distance < shortestDistance) {
                        shortestDistance = distance;
                        nearestDivision = divName;
                    }
                }

                console.log('Nearest division auto-selected:', nearestDivision);
                if (divisionSelect.value !== nearestDivision) {
                    divisionSelect.value = nearestDivision;
                    // Force update if the value changed from the default
                    updateDisplay();
                }
                return; // Success!
            }
            throw new Error("Invalid coordinate data from IP services.");
        } catch (error) {
            console.warn('Silent geolocation failed (likely AdBlocker). Trying HTML5 Geolocation...', error);

            // HTML5 Fallback
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userLat = position.coords.latitude;
                        const userLon = position.coords.longitude;

                        let nearestDivision = 'dhaka';
                        let shortestDistance = Infinity;

                        for (const [divName, coords] of Object.entries(divisions)) {
                            const dLat = coords.latitude - userLat;
                            const dLon = coords.longitude - userLon;
                            const distance = dLat * dLat + dLon * dLon;

                            if (distance < shortestDistance) {
                                shortestDistance = distance;
                                nearestDivision = divName;
                            }
                        }

                        console.log('Nearest division auto-selected (HTML5):', nearestDivision);
                        if (divisionSelect.value !== nearestDivision) {
                            divisionSelect.value = nearestDivision;
                            updateDisplay();
                        }
                    },
                    (geoErr) => {
                        console.error('HTML5 Geolocation also failed or denied:', geoErr);
                        // Default to dhaka
                        if (divisionSelect.value !== 'dhaka') {
                            divisionSelect.value = 'dhaka';
                            updateDisplay();
                        }
                    },
                    { timeout: 5000, maximumAge: 60000 }
                );
            }
        }
    }

    function updateDates() {
        const now = new Date();

        // Gregorian Date
        const formatter = new Intl.DateTimeFormat('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        gregorianDateEl.textContent = formatter.format(now);

        // Hijri Date estimation (using JS Intl)
        try {
            const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            hijriDateEl.textContent = hijriFormatter.format(now);
        } catch (e) {
            hijriDateEl.textContent = "Islamic Calendar";
        }
    }

    function formatTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        }).format(date);
    }

    function updateDisplay() {
        const selectedDivision = divisionSelect.value;
        const coordinates = divisions[selectedDivision];
        const now = new Date();
        const dateComponents = now;

        // Calculate prayer times for today
        const prayerTimes = new adhan.PrayerTimes(coordinates, dateComponents, params);

        // Sehri is Fajr, Iftar is Maghrib
        const sehriTime = prayerTimes.fajr;
        const iftarTime = prayerTimes.maghrib;

        todaySehriEl.textContent = formatTime(sehriTime);
        todayIftarEl.textContent = formatTime(iftarTime);

        // Determine the next event for countdown
        determineNextEvent(coordinates, now, sehriTime, iftarTime);

        // Render Monthly Table
        renderMonthlySchedule(coordinates, now);
    }

    function determineNextEvent(coordinates, now, todaySehri, todayIftar) {
        let nextEventTime;
        let eventName;

        if (now < todaySehri) {
            // Next is today's Sehri
            nextEventTime = todaySehri;
            eventName = "Sehri Ends In";
        } else if (now < todayIftar) {
            // Next is today's Iftar
            nextEventTime = todayIftar;
            eventName = "Iftar Starts In";
        } else {
            // Next is tomorrow's Sehri
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowDateComponents = tomorrow;
            const tomorrowPrayerTimes = new adhan.PrayerTimes(coordinates, tomorrowDateComponents, params);

            nextEventTime = tomorrowPrayerTimes.fajr;
            eventName = "Sehri Ends In";
        }

        nextEventTitle.textContent = eventName;
        startCountdown(nextEventTime);
    }

    function startCountdown(targetTime) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        function updateTimer() {
            const now = new Date().getTime();
            const distance = targetTime.getTime() - now;

            if (distance <= 0) {
                clearInterval(countdownInterval);
                hEl.textContent = "00";
                mEl.textContent = "00";
                sEl.textContent = "00";

                // Refresh to get the next event (add 1 sec delay to ensure time passed)
                setTimeout(() => updateDisplay(), 1000);
                return;
            }

            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            hEl.textContent = hours.toString().padStart(2, '0');
            mEl.textContent = minutes.toString().padStart(2, '0');
            sEl.textContent = seconds.toString().padStart(2, '0');
        }

        updateTimer(); // run immediately
        countdownInterval = setInterval(updateTimer, 1000);
    }

    function renderMonthlySchedule(coordinates, now) {
        // Ramadan 1447 AH / 2026 Starts Feb 19
        const ramadanStart = new Date('2026-02-19T00:00:00');

        // Update title
        monthNameEl.textContent = 'Ramadan 1447 AH (2026)';

        // Clear previous schedule
        scheduleBody.innerHTML = '';

        // Ramadan has 30 days
        for (let day = 0; day < 30; day++) {
            const date = new Date(ramadanStart);
            date.setDate(ramadanStart.getDate() + day);

            const dateComponents = date;
            const prayerTimes = new adhan.PrayerTimes(coordinates, dateComponents, params);

            const tr = document.createElement('tr');

            // Highlight today's row
            if (date.toDateString() === now.toDateString()) {
                tr.classList.add('today-row');

                // Keep the today row somewhat visible by scrolling to it later if needed
                setTimeout(() => {
                    // tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }

            const dateFormatted = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
            const dayFormatted = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);

            const sehriStr = formatTime(prayerTimes.fajr);
            const iftarStr = formatTime(prayerTimes.maghrib);

            tr.innerHTML = `
                <td>Ramadan ${day + 1}<br><span style="font-size: 0.85em; color: var(--text-muted);">${dateFormatted}</span></td>
                <td>${dayFormatted}</td>
                <td style="color: var(--secondary); font-weight: 500;">${sehriStr}</td>
                <td style="color: var(--accent); font-weight: 500;">${iftarStr}</td>
            `;

            scheduleBody.appendChild(tr);
        }
    }

    // Start
    init();
});

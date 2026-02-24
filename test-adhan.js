const fs = require('fs');
global.window = {};
const adhanCode = fs.readFileSync('./adhan.js', 'utf8');
eval(adhanCode);
const adhan = (typeof window !== 'undefined' && window.adhan) ? window.adhan : global.adhan;

const coordinates = new adhan.Coordinates(23.8103, 90.4125);
const date = new Date('2026-02-19T00:00:00');
const params = adhan.CalculationMethod.Karachi();

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

console.log('--- No Adjustments ---');
const times = new adhan.PrayerTimes(coordinates, date, params);
console.log('Fajr (Sehri Base):', formatTime(times.fajr));
console.log('Maghrib (Iftar Base):', formatTime(times.maghrib));

params.adjustments.fajr = -1;
params.adjustments.maghrib = 1;
console.log('--- Expected Adjustments (F: -1, M: 1) ---');
const timesAdj = new adhan.PrayerTimes(coordinates, date, params);
console.log('Fajr (Sehri):', formatTime(timesAdj.fajr));
console.log('Maghrib (Iftar):', formatTime(timesAdj.maghrib));

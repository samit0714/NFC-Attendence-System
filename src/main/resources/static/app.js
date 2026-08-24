const API_BASE = 'https://nfc-backend-samit.onrender.com/api';
let weeklyTimetableCache = []; // Timetable save karne ke liye

document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchSchedule();
    loadPersistentPredictor();
    
    // Background mein poora timetable fetch kar rahe hain
    fetch(`${API_BASE}/all-schedule`)
        .then(res => res.json())
        .then(data => { weeklyTimetableCache = data; });
});

// --- Sound & Haptics Engine ---
function playBeep(frequency, duration) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (duration / 1000));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (duration / 1000));
    } catch (e) {}
}

function triggerVibration(pattern) {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
}

function getLocalDateString() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
}

function fetchStats() {
    fetch(`${API_BASE}/stats`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('current-percentage').textContent = data.percentage + '%';
            document.getElementById('current-percentage').style.color = data.percentage >= 75 ? '#00b09b' : '#ff416c';
            document.getElementById('classes-needed').textContent = data.percentage >= 75 ? 'Safe! (0)' : data.classesNeededFor75;
            document.getElementById('classes-needed').style.color = data.percentage >= 75 ? '#00b09b' : '#ff416c';
        });
}

function fetchSchedule() {
    const scheduleContainer = document.getElementById('schedule-container');
    fetch(`${API_BASE}/today-schedule`)
        .then(response => response.json())
        .then(data => {
            scheduleContainer.innerHTML = ''; 
            if (data.length === 0) {
                scheduleContainer.innerHTML = `<div style="text-align:center; padding: 30px 0; color: #a0aec0;">No classes scheduled for today.</div>`;
                return;
            }

            data.forEach((item, index) => {
                const startTime = item.startTime.substring(0, 5);
                const endTime = item.endTime.substring(0, 5);
                const color = item.percentage >= 75 ? '#00b09b' : '#ff416c';
                const needText = item.needed > 0 ? `Need ${item.needed} more` : 'Safe!';

                let actionHTML = '';
                if (item.todayStatus) {
                    let statColor = item.todayStatus === 'Present' ? '#00b09b' : item.todayStatus === 'Absent' ? '#ff416c' : '#f1c40f';
                    let icon = item.todayStatus === 'Holiday' ? 'fa-bed' : 'fa-circle-check';
                    actionHTML = `<div style="font-size: 13px; color: ${statColor}; font-weight: 600; text-align: center; margin-top: 15px;"><i class="fa-solid ${icon}"></i> Marked as ${item.todayStatus}</div>`;
                } else {
                    actionHTML = `
                    <div class="action-buttons">
                        <button class="btn btn-present" onclick="markAttendance(${item.id}, 'Present', this)"><i class="fa-solid fa-check"></i> Present</button>
                        <button class="btn btn-absent" onclick="markAttendance(${item.id}, 'Absent', this)"><i class="fa-solid fa-xmark"></i> Absent</button>
                        <button class="btn btn-holiday" onclick="markAttendance(${item.id}, 'Holiday', this)"><i class="fa-solid fa-bed"></i></button>
                    </div>`;
                }

                const card = document.createElement('div');
                card.className = 'subject-card';
                card.style.animationDelay = `${index * 0.1}s`;
                
                card.innerHTML = `
                    <div class="subject-header">
                        <div>
                            <div class="subject-name">${item.subjectName}</div>
                            <span class="subject-type">${item.classType} • Batch: ${item.targetBatch}</span>
                        </div>
                        <div class="subject-time">${startTime} - ${endTime}</div>
                    </div>
                    
                    <div class="subject-stats-container">
                        <div class="stat-text-row">
                            <span style="color: ${color}"><i class="fa-solid fa-chart-line"></i> ${item.percentage}% (${item.attended}/${item.held})</span>
                            <span style="color: ${color}">${needText}</span>
                        </div>
                        <div class="mini-progress-bg">
                            <div class="mini-progress-fill" style="width: ${item.percentage}%; background: ${color};"></div>
                        </div>
                    </div>
                    ${actionHTML}
                    
                    <!-- 🌟 NAYA SMART ANALYTICS BUTTON (Timetable ke hisaab se) -->
                    <button class="analytics-toggle" onclick="toggleAdvancedAnalytics(${item.id}, '${item.subjectName}', ${item.attended}, ${item.held})">
                        Timetable Smart Analytics <i class="fa-solid fa-chevron-down" id="icon-${item.id}"></i>
                    </button>
                    
                    <div id="analytics-${item.id}" class="smart-analytics-box hidden">
                        <!-- Data Yahan JS se aayega -->
                    </div>
                `;
                scheduleContainer.appendChild(card);
            });
        });
}

// 🌟 THE NEW LOGIC: Timetable + Date based calculation
function toggleAdvancedAnalytics(id, subjectName, attended, held) {
    const box = document.getElementById(`analytics-${id}`);
    const icon = document.getElementById(`icon-${id}`);

    if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');

        let examDateStr = localStorage.getItem('examEndDate');
        if (!examDateStr) {
            box.innerHTML = `<div style="color: #ff416c; padding: 10px; background: rgba(255,0,0,0.1); border-radius: 8px; text-align: center; font-size: 12px;">
                <i class="fa-solid fa-calendar-xmark" style="font-size: 16px;"></i><br>
                Please set your <b>Exam Date</b> in the Predictor first!
            </div>`;
            return;
        }

        // Calculation shuru (Kal se leke Exam Date tak)
        let start = new Date();
        start.setDate(start.getDate() + 1); 
        start.setHours(0,0,0,0);
        let end = new Date(examDateStr);
        end.setHours(23,59,59,999);

        let futureClasses = 0;
        let current = new Date(start);
        
        // Check finding this subject in timetable for everyday till exam
        while (current <= end) {
            let dayName = current.toLocaleDateString('en-US', { weekday: 'long' });
            let count = weeklyTimetableCache.filter(c => c.subjectName === subjectName && c.dayOfWeek === dayName).length;
            futureClasses += count;
            current.setDate(current.getDate() + 1);
        }

        let newTotalHeld = held + futureClasses;
        let neededFor75 = Math.ceil(0.75 * newTotalHeld);
        let moreClassesNeeded = neededFor75 - attended;

        let resultHTML = '';
        if (moreClassesNeeded <= 0) {
            resultHTML = `<div style="color: #00b09b; padding: 10px; background: rgba(0,255,0,0.1); border-radius: 8px; text-align: center; font-size: 12px;">
                  <i class="fa-solid fa-shield-halved" style="font-size: 16px; margin-bottom: 5px;"></i><br>
                  <b>100% Safe!</b><br>
                  Apko is subject ki aage classes attend karne ki zaroorat nahi hai. Enjoy! 😎<br>
                  <span style="font-size: 10px; color: gray;">(Future classes scheduled: ${futureClasses})</span>
                </div>`;
        } else if (moreClassesNeeded > futureClasses) {
            resultHTML = `<div style="color: #ff416c; padding: 10px; background: rgba(255,0,0,0.1); border-radius: 8px; text-align: center; font-size: 12px;">
                  <i class="fa-solid fa-triangle-exclamation" style="font-size: 16px; margin-bottom: 5px;"></i><br>
                  <b>Target Impossible ❌</b><br>
                  Exam tak sirf ${futureClasses} class bachi hain, par apko 75% ke liye ${moreClassesNeeded} karni padengi.
                </div>`;
        } else {
            resultHTML = `<div style="color: #f1c40f; padding: 10px; background: rgba(255,255,0,0.1); border-radius: 8px; text-align: center; font-size: 12px;">
                  <i class="fa-solid fa-person-running" style="font-size: 16px; margin-bottom: 5px;"></i><br>
                  <b>Focus Required ⚠️</b><br>
                  Exam tak ${futureClasses} class hongi. Apko unme se <b>${moreClassesNeeded} classes</b> zaroor attend karni padengi!
                </div>`;
        }
        box.innerHTML = resultHTML;

    } else {
        box.classList.add('hidden');
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

function markAttendance(subjectId, status, buttonElement) {
    if (status === 'Present') { playBeep(1200, 100); triggerVibration(50); }
    else if (status === 'Absent') { playBeep(300, 300); triggerVibration([50, 100, 50]); }
    else if (status === 'Holiday') { playBeep(700, 150); triggerVibration(40); }

    fetch(`${API_BASE}/mark-attendance?subjectId=${subjectId}&status=${status}`, { method: 'POST' })
    .then(() => {
        fetchStats();
        fetchSchedule(); 
        if(localStorage.getItem('examEndDate')) calculatePrediction(true);
    });
}

function openPredictor() { 
    document.getElementById('predictor-modal').classList.remove('hidden'); 
    let start = localStorage.getItem('examStartDate');
    let end = localStorage.getItem('examEndDate');
    document.getElementById('start-date').value = start ? start : getLocalDateString();
    if(end) document.getElementById('end-date').value = end;
}

function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }

function calculatePrediction(isSilent = false) {
    let start, end;
    if(isSilent) {
        start = localStorage.getItem('examStartDate');
        end = localStorage.getItem('examEndDate');
    } else {
        start = document.getElementById('start-date').value;
        end = document.getElementById('end-date').value;
        localStorage.setItem('examStartDate', start);
        localStorage.setItem('examEndDate', end);
    }
    if(!start || !end) return;

    fetch(`${API_BASE}/predict?startDate=${start}&endDate=${end}`)
        .then(res => res.json())
        .then(data => {
            if(!isSilent) closeModal('predictor-modal');
            let pCard = document.getElementById('persistent-predictor');
            let color = data.is75Possible ? '#00b09b' : '#ff416c';
            pCard.innerHTML = `
                <i class="fa-solid fa-calendar-day" style="color: #8e2de2; font-size: 24px;"></i>
                <div style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span class="stat-value" style="color: ${color}">${data.predictedPercentage}% Expected</span>
                        <span style="font-size: 11px; color: #a0aec0;">${data.futureClassesCount} Classes left</span>
                    </div>
                    <span class="stat-label">Target: ${new Date(end).toLocaleDateString('en-GB')}</span>
                </div>
            `;
        });
}

// 🌟 NAYA: Jab tak server jaagta hai, tab tak "Loading" message dikhayega
function loadPersistentPredictor() {
    if(localStorage.getItem('examEndDate') && localStorage.getItem('examStartDate')) {
        let pCard = document.getElementById('persistent-predictor');
        if (!pCard) {
            pCard = document.createElement('div');
            pCard.id = 'persistent-predictor';
            pCard.className = 'glass-card stat-box';
            pCard.style.gridColumn = 'span 2';
            pCard.innerHTML = `<div style="text-align: center; width: 100%; color: #a0aec0; font-size: 11px;"><i class="fa-solid fa-spinner fa-spin"></i> Waking up Cloud Server...</div>`;
            document.querySelector('.stats-container').appendChild(pCard);
        }
        calculatePrediction(true);
    }
}

function openTimetable() {
    document.getElementById('timetable-modal').classList.remove('hidden');
    const container = document.getElementById('full-timetable-container');
    container.innerHTML = '<div class="loading-text">Loading Timetable...</div>';
    fetch(`${API_BASE}/all-schedule`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            const daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const grouped = {};
            data.forEach(item => {
                if(!grouped[item.dayOfWeek]) grouped[item.dayOfWeek] = [];
                grouped[item.dayOfWeek].push(item);
            });
            daysOrder.forEach(day => {
                if(grouped[day]) {
                    let dayHTML = `<h4 style="color: var(--primary); margin: 15px 0 5px; border-bottom: 1px solid var(--glass-border); padding-bottom: 5px;">${day}</h4>`;
                    grouped[day].forEach(cls => {
                        dayHTML += `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;"><strong style="color: white;">${cls.subjectName}</strong><br><span style="color: #a0aec0;">${cls.startTime.substring(0, 5)} - ${cls.endTime.substring(0, 5)} | ${cls.classType}</span></div>`;
                    });
                    container.innerHTML += dayHTML;
                }
            });
        });
}

function openSubjectReport() {
    document.getElementById('subject-report-modal').classList.remove('hidden');
    const container = document.getElementById('subject-report-container');
    container.innerHTML = '<div class="loading-text">Loading Subject Analytics...</div>';
    fetch(`${API_BASE}/all-subjects-stats`)
        .then(res => res.json())
        .then(data => {
            container.innerHTML = '';
            data.forEach(sub => {
                const color = sub.percentage >= 75 ? '#00b09b' : '#ff416c';
                let bunkText = sub.held > 0 ? (sub.percentage >= 75 ? `<span style="color: #00b09b; font-size: 11px;"><i class="fa-solid fa-couch"></i> Safe to bunk ${sub.safeBunks}</span>` : `<span style="color: #ff416c; font-size: 11px;"><i class="fa-solid fa-triangle-exclamation"></i> Need ${sub.needed} classes</span>`) : `<span style="color: gray; font-size: 11px;">No classes held</span>`;
                container.innerHTML += `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <strong style="color: white; font-size: 14px;">${sub.subjectName}</strong>
                        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                            <span style="color: ${color}; font-size: 12px; font-weight: bold;">${sub.percentage}% (${sub.attended}/${sub.held})</span>
                            ${bunkText}
                        </div>
                        <div class="mini-progress-bg" style="margin-top: 5px;"><div class="mini-progress-fill" style="width: ${sub.percentage}%; background: ${color};"></div></div>
                    </div>`;
            });
        }).catch(() => container.innerHTML = `<div style="color: #ff416c; text-align: center; padding: 20px;">Connection Error!</div>`);
}

function resetSystem() {
    if(confirm("WARNING: Delete ALL attendance data?")) {
        fetch(`${API_BASE}/reset-attendance`, { method: 'DELETE' }).then(res => {
            localStorage.removeItem('examStartDate');
            localStorage.removeItem('examEndDate');
            location.reload(); 
        });
    }
}
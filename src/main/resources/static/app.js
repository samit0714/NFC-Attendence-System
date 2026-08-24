document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchSchedule();
    loadPersistentPredictor();
});

function getLocalDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}   

function fetchStats() {
    fetch(' https://nfc-backend-samit.onrender.com/api/stats')
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
    fetch(' https://nfc-backend-samit.onrender.com/api/today-schedule')
        .then(response => response.json())
        .then(data => {
            scheduleContainer.innerHTML = ''; 
            if (data.length === 0) {
                scheduleContainer.innerHTML = `<div style="text-align:center; padding: 30px 0; color: #a0aec0;"><p>No classes scheduled for today.</p></div>`;
                return;
            }

            data.forEach((item, index) => {
                const startTime = item.startTime.substring(0, 5);
                const endTime = item.endTime.substring(0, 5);
                const color = item.percentage >= 75 ? '#00b09b' : '#ff416c';
                const needText = item.needed > 0 ? `Need ${item.needed} more` : 'Safe!';

                let safeBunks = 0;
                let bunkHTML = '';
                if(item.held > 0) {
                    if (item.percentage >= 75) {
                        safeBunks = Math.floor((item.attended / 0.75) - item.held);
                        bunkHTML = `<div class="bunk-safe"><i class="fa-solid fa-couch"></i> You can safely bunk ${safeBunks} classes!</div>`;
                    } else {
                        bunkHTML = `<div class="bunk-danger"><i class="fa-solid fa-triangle-exclamation"></i> Attend ${item.needed} classes back-to-back.</div>`;
                    }
                } else {
                    bunkHTML = `<div style="font-size: 12px; color: gray;">No classes held yet.</div>`;
                }

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
                    
                    <button class="analytics-toggle" onclick="toggleAnalytics(${item.id})">
                        Smart Analytics <i class="fa-solid fa-chevron-down" id="icon-${item.id}"></i>
                    </button>
                    
                    <div id="analytics-${item.id}" class="smart-analytics-box hidden">
                        ${bunkHTML}
                        <div class="slider-container">
                            <div class="slider-label">
                                <span>Custom Target: <span id="target-val-${item.id}">75</span>%</span>
                            </div>
                            <input type="range" class="target-slider" min="50" max="100" value="75" 
                                oninput="calculateCustomTarget(${item.id}, ${item.attended}, ${item.held}, this.value)">
                            <div id="slider-result-${item.id}" class="slider-result">...</div>
                        </div>
                    </div>
                `;
                scheduleContainer.appendChild(card);
                if(item.held > 0) calculateCustomTarget(item.id, item.attended, item.held, 75);
            });
        });
}

function toggleAnalytics(id) {
    const box = document.getElementById(`analytics-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        box.classList.add('hidden');
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}

function calculateCustomTarget(id, attended, held, targetPerc) {
    document.getElementById(`target-val-${id}`).innerText = targetPerc;
    const resultDiv = document.getElementById(`slider-result-${id}`);
    const target = targetPerc / 100;
    
    if (held === 0) {
        resultDiv.innerText = "Classes haven't started yet.";
        return;
    }

    let currentPerc = attended / held;
    if (currentPerc >= target) {
        let safeToBunk = Math.floor((attended / target) - held);
        resultDiv.innerHTML = `<span style="color: #00b09b;">Safe to bunk ${safeToBunk} classes!</span>`;
    } else {
        let needed = Math.ceil((target * held - attended) / (1 - target));
        resultDiv.innerHTML = `<span style="color: #ff416c;">Need ${needed} classes back-to-back.</span>`;
    }
}

function markAttendance(subjectId, status, buttonElement) {
    fetch(`https://nfc-backend-samit.onrender.com/api/mark-attendance?subjectId=${subjectId}&status=${status}`, { method: 'POST' })
    .then(() => {
        fetchStats();
        fetchSchedule(); 
        if(localStorage.getItem('examEndDate')) calculatePrediction(true);
    });
}

function openPredictor() { 
    document.getElementById('predictor-modal').classList.remove('hidden'); 
    if(localStorage.getItem('examStartDate')) {
        document.getElementById('start-date').value = localStorage.getItem('examStartDate');
    } else {
        document.getElementById('start-date').value = getLocalDateString();
    }
    if(localStorage.getItem('examEndDate')) {
        document.getElementById('end-date').value = localStorage.getItem('examEndDate');
    }
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

    fetch(`https://nfc-backend-samit.onrender.com/api/predict?startDate=${start}&endDate=${end}`)
        .then(res => res.json())
        .then(data => {
            if(!isSilent) closeModal('predictor-modal');
            let pCard = document.getElementById('persistent-predictor');
            if (!pCard) {
                pCard = document.createElement('div');
                pCard.id = 'persistent-predictor';
                pCard.className = 'glass-card stat-box';
                pCard.style.gridColumn = 'span 2';
                const statsContainer = document.querySelector('.stats-container');
                statsContainer.appendChild(pCard);
            }
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

function loadPersistentPredictor() {
    if(localStorage.getItem('examEndDate') && localStorage.getItem('examStartDate')) {
        calculatePrediction(true);
    }
}

function openTimetable() {
    document.getElementById('timetable-modal').classList.remove('hidden');
    const container = document.getElementById('full-timetable-container');
    container.innerHTML = '<div class="loading-text">Loading Timetable...</div>';
    fetch('https://nfc-backend-samit.onrender.com/api/all-schedule')
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
                        const start = cls.startTime.substring(0, 5);
                        const end = cls.endTime.substring(0, 5);
                        dayHTML += `<div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; font-size: 13px;"><strong style="color: white;">${cls.subjectName}</strong><br><span style="color: #a0aec0;">${start} - ${end} | ${cls.classType}</span></div>`;
                    });
                    container.innerHTML += dayHTML;
                }
            });
        });
}

// 🌟 THE MISSING LINK FOR SUBJECT REPORT FIXED
function openSubjectReport() {
    document.getElementById('subject-report-modal').classList.remove('hidden');
    const container = document.getElementById('subject-report-container');
    container.innerHTML = '<div class="loading-text">Loading Subject Analytics...</div>';

    fetch('https://nfc-backend-samit.onrender.com/api/all-subjects-stats')
        .then(res => {
            if (!res.ok) throw new Error("API Not Found! Server properly restart nahi hua.");
            return res.json();
        })
        .then(data => {
            container.innerHTML = '';
            
            if(data.length === 0) {
                container.innerHTML = '<div style="color: gray; text-align: center; font-size: 13px;">No subjects found in timetable!</div>';
                return;
            }

            data.forEach(sub => {
                const color = sub.percentage >= 75 ? '#00b09b' : '#ff416c';
                let bunkText = '';
                
                if(sub.held > 0) {
                    if(sub.percentage >= 75) {
                        bunkText = `<span style="color: #00b09b; font-size: 11px;"><i class="fa-solid fa-couch"></i> Safe to bunk ${sub.safeBunks}</span>`;
                    } else {
                        bunkText = `<span style="color: #ff416c; font-size: 11px;"><i class="fa-solid fa-triangle-exclamation"></i> Need ${sub.needed} classes</span>`;
                    }
                } else {
                    bunkText = `<span style="color: gray; font-size: 11px;">No classes held</span>`;
                }

                container.innerHTML += `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                        <strong style="color: white; font-size: 14px;">${sub.subjectName}</strong>
                        <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                            <span style="color: ${color}; font-size: 12px; font-weight: bold;">${sub.percentage}% (${sub.attended}/${sub.held})</span>
                            ${bunkText}
                        </div>
                        <div class="mini-progress-bg" style="margin-top: 5px;">
                            <div class="mini-progress-fill" style="width: ${sub.percentage}%; background: ${color};"></div>
                        </div>
                    </div>
                `;
            });
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `
                <div style="color: #ff416c; text-align: center; font-size: 13px; padding: 20px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                    <b>Connection Error!</b><br>
                    Please completely STOP the Java server in VS Code and RUN it again.
                </div>`;
        });
}

function resetSystem() {
    if(confirm("WARNING: Are you sure you want to delete ALL attendance data? This cannot be undone.")) {
        fetch('https://nfc-backend-samit.onrender.com/api/reset-attendance', { method: 'DELETE' })
        .then(res => res.text())
        .then(msg => {
            alert(msg);
            localStorage.removeItem('examStartDate');
            localStorage.removeItem('examEndDate');
            location.reload(); 
        });
    }
}
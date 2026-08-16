const STORAGE_KEY = "skilltrack-data";
const ONE_DAY_MS = 86400000;

// STEP 1 - LOAD SAMPLE-SKILLS.JSON, SAVE AND READ FROM LOCALSTORAGE.
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
        return null;
    } else {
        return JSON.parse(stored);
    }
}

async function initialData() {
    let data = loadData();

    if (data === null) {
        const response = await fetch("./data/sample-skills.json");
        data = await response.json();
        data = shiftDatesToToday(data);
        saveData(data);
    }

    return data;
}

// STEP 2 - THE PURE LOGIC. STREAK CALCS, TOTAL HOURS, AND DAILY HEATMAP. 
function getSessionsBySkill(sessions, skillId) {
    return sessions.filter(function(session) {
        return session.skillId === skillId;
    });
}

function getTotalMinutes(sessions) {
    const initialValue = 0;

    return sessions.reduce(function(total, session) {
        return total + session.durationMinutes;
    }, initialValue);
}

// STREAK FUNCTION, GETS A LIST OF OBJECTS AND RETURNS A LIST OF DATES
function getPracticeDates(sessions) {
    return sessions.map(function(session) {
        return session.date;
    });
}

// PREVENTS REPETITION BY NEW SET(DATES), SORT WILL ORDER FROM OLDER TO NEWER WHEREAS REVERSE WILL INVERT AND PLACE THE NEWER ON TOP
function getUniqueDates(dates) {
    const unique = Array.from(new Set(dates));
    return unique.sort().reverse();
}

// RUNNING ALONG THE LIST COMPARING EACH DATE WITH THE FOLLOWING, WHILE THE COUNTER IS ONE DAY, THE COUNTER GOES UP
function getStreak(dates) {
    if (dates.length === 0) {
        return 0;
    }

    let streak = 1;

    for (let i = 0; i < dates.length - 1; i++) {
        const current = new Date(dates[i]);
        const previous = new Date(dates[i + 1]);

        if (current - previous === ONE_DAY_MS) {
            streak = streak + 1;
        } else {
            break;
        }
    }

    return streak;
}

// THE HEATMAP KNOWS THAT FOR EACH DAY THE MANY MINUTES WERE PRACTICING.
function getMinutesByDate(sessions) {
    const totals = {};

    for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];

        if (totals[session.date] === undefined) {
            totals[session.date] = 0;
        }

        totals[session.date] = totals[session.date] + session.durationMinutes;
    }

    return totals;
}

// INITIALLY THE SESSION DATES WOULD END UP BY THE 19/03 AND TODAY IS JULY THE 28TH. SO MY HEATMAP WOULD SHOULD 4 EMPTY MONTHS, THIS FUNCTION SLIDES EVERYTHING FORWARD
function shiftDatesToToday(data) {
    const dates = getUniqueDates(getPracticeDates(data.sessions));
    const latest = dates[0];

    const today = new Date().toISOString().slice(0, 10);
    const offset = new Date(today) - new Date(latest);

    for (let i = 0; i < data.sessions.length; i++) {
        const session = data.sessions[i];
        const shifted = new Date(session.date).getTime() + offset;
        session.date = new Date(shifted).toISOString().slice(0, 10);
    }

    return data;
}

// STEP 4 - RENDERING
function renderSkills(data) {
    const grid = document.querySelector(".skills-grid");
    let html = "";

    for (let i = 0; i < data.skills.length; i++) {
        const skill = data.skills[i];
        const skillSessions = getSessionsBySkill(data.sessions, skill.id);
        const minutes = getTotalMinutes(skillSessions);
        const dates = getUniqueDates(getPracticeDates(skillSessions));
        const streak = getStreak(dates);
        const hours = (minutes / 60).toFixed(1);

        html = html + 
        `
        <div class="skill-card">
            <h3 class="skill-name">${skill.name}</h3>
            <p class="skill-stat"><span class="skill-value">${hours}h</span>Total hours</p>
            <p class="skill-stat"><span class="skill-value">${streak}</span>Day streak</p>
        </div>
        `;
    }

    grid.innerHTML = html;
}

initialData().then(function (data) {
    renderSkills(data);
});
const STORAGE_KEY = "skilltrack-data";

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
    };
}

async function initialData() {
    let data = loadData();

    if (data === null) {
        const response = await fetch("./data/sample-skills.json");
        data = await response.json();
        saveData(data);
    };

    return data;
}

// STEP 2 - THE PURE LOGIC. STREAK CALCS, TOTAL HOURS, AND DAILY HEATMAP. 
function getSessionsBySkill (sessions, skillId) {
    return sessions.filter(function(session) {
        return session.skillId === skillId;
    });
}

function getTotalMinutes (sessions) {
    const initialValue = 0;

    return sessions.reduce(function (total, session) {
        return total + session.durationMinutes;
    }, initialValue);
}

// initialData().then(function (data) {
//     const spanishSessions = getSessionsBySkill(data.sessions, "skill-1");
//     console.log(getTotalMinutes(spanishSessions));
// });
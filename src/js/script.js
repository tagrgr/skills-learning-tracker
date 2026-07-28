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
        const today = new Date(dates[i]);
        const yesterday = new Date(dates[i + 1]);

        if (today - yesterday === ONE_DAY_MS) {
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

initialData().then(function (data) {
    console.log(getMinutesByDate(data.sessions));
});
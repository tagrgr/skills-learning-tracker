const STORAGE_KEY = "skilltrack-data";
const ONE_DAY_MS = 86400000;
const RING_CIRCUMFERENCE = 327;

// DATA LAYER - LOAD SAMPLE-SKILLS.JSON, SAVE AND READ FROM LOCALSTORAGE.
function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// READS THE SAVED DATA BACK FROM LOCALSTORAGE. RETURNS NULL WHEN NOTHING WAS EVER SAVED — THAT'S HOW INITIALDATA KNOWS IT'S A FIRST VISIT.
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === null) {
        return null;
    } else {
        return JSON.parse(stored);
    }
}

// RETURNS THE APP DATA, SEEDING IT ON THE FIRST VISIT. AFTER THAT THE JSON IS NEVER READ AGAIN — EVERYTHING COMES FROM LOCALSTORAGE, SO THE USER'S OWN CHANGES ARE NEVER OVERWRITTEN.
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

// CALCULATIONS - THE PURE LOGIC. STREAK CALCS, TOTAL HOURS, AND DAILY HEATMAP. 
function getSessionsBySkill(sessions, skillId) {
    return sessions.filter(function(session) {
        return session.skillId === skillId;
    });
}

// SUMS THE DURATION OF EVERY SESSION IN THE LIST. RETURNS MINUTES, NOT HOURS — THE CONVERSION IS DONE WHEN DISPLAYING, SO THE CALCULATION STAYS EXACT.
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

// SORTS SKILLS FROM MOST TO LEAST PRACTICED — THE FIRST FILLS THE FEATURED CARD, THE NEXT THREE FILL THE GRID.
function getSkillsByPractice(data) {
    const skills = data.skills.slice();

    skills.sort(function (a, b) {
        const aMinutes = getTotalMinutes(getSessionsBySkill(data.sessions, a.id));
        const bMinutes = getTotalMinutes(getSessionsBySkill(data.sessions, b.id));
        return bMinutes - aMinutes;
    });

    return skills;
}

// RENDERING
// DRAWS THE SKILL CARDS INTO THE GRID. THE LIST TO DRAW COMES AS A SEPARATE ARGUMENT, NOT FROM DATA.SKILLS — THAT'S WHAT LETS THE CALLER LEAVE OUT THE FEATURED SKILL INSTEAD OF ALWAYS SHOWING ALL SIX.
function renderSkills(data, skills) {
    const grid = document.querySelector(".skills-grid");
    let html = "";

    for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        const skillSessions = getSessionsBySkill(data.sessions, skill.id);
        const minutes = getTotalMinutes(skillSessions);
        const dates = getUniqueDates(getPracticeDates(skillSessions));
        const streak = getStreak(dates);
        const hours = (minutes / 60).toFixed(1);

        html = html + 
        `
        <li class="skill-card card">
            <h3 class="skill-name">${skill.name}</h3>
            <p class="skill-stat"><span class="skill-value">${hours}h</span></p>
            <p class="skill-stat">🔥 ${streak}-day streak</p>
        </li>
        `;
    }

    grid.innerHTML = html;
}

// HEATMAP - ONE SQUARE PER DAY, COLORED BY MINUTES PRACTICED.
function renderHeatmap() {
    const heatMapping = document.querySelector(".heatmap");
    let html = "";

    for (let i = 0; i < 126; i++) {
        html = html + `<div class="heatmap-day"></div>`;
    }

    heatMapping.innerHTML = html;
}

// MAKING SQUARES KNOW WHICH DAY IT REPRESENTS.
function getHeatmapDates(days) {
    const dates = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today.getTime() - i * ONE_DAY_MS);
        dates.push(date.toISOString().slice(0, 10));
    }

    return dates;
}

// TURNS A DAY'S MINUTES INTO A COLOUR LEVEL. THE WORD RETURNED BECOMES A CSS CLASS (HEATMAP-LIGHT, HEATMAP-HEAVY...). UNDEFINED MEANS THE DAY HAS NO SESSIONS AT ALL, BECAUSE GETMINUTESBYDATE ONLY CREATES KEYS FOR DAYS THAT WERE PRACTISED.
function getHeatmapLevel(minutes) {
    if (minutes === undefined || minutes === 0) {
        return "empty";
    } else if (minutes < 30) {
        return "light";
    } else if (minutes >= 30 && minutes < 60) {
        return "medium";
    } else {
        return "heavy";
    }
}

// DRAWS 126 SQUARES — 18 WEEKS OF 7 DAYS — FROM THE OLDEST DATE UP TO TODAY. THE CSS GRID FILLS THEM COLUMN BY COLUMN, SO EACH COLUMN COMES OUT AS ONE WEEK.
function renderHeatmap(data) {
    const heatmap = document.querySelector(".heatmap");
    const dates = getHeatmapDates(126);
    const minutesByDate = getMinutesByDate(data.sessions);
    let html = "";

    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const minutes = minutesByDate[date];
        const level = getHeatmapLevel(minutes);

        html = html + `<div class="heatmap-day heatmap-${level}"></div>`;
    }

    heatmap.innerHTML = html;
}

// FILLS THE FEATURED CARD WITH THE MOST PRACTISED SKILL. UNLIKE RENDERSKILLS, THIS ONE DOESN'T BUILD HTML — THE CARD ALREADY EXISTS IN THE PAGE WITH ITS SVG RING, SO ONLY THE TEXT VALUES GET REPLACED.
function renderFeatured(data, skill) {
    const sessions = getSessionsBySkill(data.sessions, skill.id);
    const minutes = getTotalMinutes(sessions);
    const dates = getUniqueDates(getPracticeDates(sessions));
    const streak = getStreak(dates);

    document.querySelector(".featured-name").textContent = skill.name;
    document.querySelector(".featured-hours").textContent = (minutes / 60).toFixed(1) + "h";
    document.querySelector(".featured-streak").textContent = "🔥 " + streak;

    const percent = getGoalProgress(data, skill);
    const ringText = document.querySelector(".ring-percent");
    const ringProgress = document.querySelector(".ring-progress");

    if (percent === null) {
        ringText.textContent = "—";
        ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE;
    } else {
        ringText.textContent = percent + "%";
        ringProgress.style.strokeDashoffset = RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * percent / 100);
    }
}

// SUMS THE MINUTES PRACTISED IN THE LAST N DAYS. REUSES GETHEATMAPDATES TO BUILD THE LIST OF DATES THAT COUNT, SO THE WINDOW ALWAYS ENDS ON TODAY.
function getMinutesInLastDays(sessions, days) {
    const recentDates = getHeatmapDates(days);

    const recentSessions = sessions.filter(function (session) {
        return recentDates.includes(session.date);
    });

    return getTotalMinutes(recentSessions);
}

// HOW FAR A SKILL IS TOWARDS ITS GOAL, AS A PERCENTAGE. RETURNS NULL WHEN THE SKILL HAS NO GOAL — THE CALLER DECIDES WHAT TO SHOW. WEEKLY GOALS ONLY COUNT THE LAST 7 DAYS, TOTAL GOALS COUNT EVERYTHING. CAPPED AT 100 SO THE RING NEVER LOOPS TWICE.
function getGoalProgress(data, skill) {
    if (skill.goal === null) {
        return null;
    }

    const sessions = getSessionsBySkill(data.sessions, skill.id);
    const targetMinutes = skill.goal.targetHours * 60;
    let minutes;

    if (skill.goal.type === "weekly") {
        minutes = getMinutesInLastDays(sessions, 7);
    } else {
        minutes = getTotalMinutes(sessions);
    }

    const percent = Math.round((minutes / targetMinutes) * 100);
    return Math.min(percent, 100);
}


// ENTRY POINT — RUNS ONCE THE DATA IS READY. SLICE(1, 4) SKIPS THE MOST PRACTISED SKILL, WHICH BELONGS TO THE FEATURED CARD, AND TAKES THE NEXT THREE FOR THE GRID.
initialData().then(function (data) {
    const sorted = getSkillsByPractice(data);
    const others = sorted.slice(1, 4);

    renderFeatured(data, sorted[0]);
    renderSkills(data, others);
    renderHeatmap(data);
});









































































































































































































































































































































































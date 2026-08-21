const STORAGE_KEY = "skilltrack-data";
const ONE_DAY_MS = 86400000;
const RING_CIRCUMFERENCE = 327;
const NAME_KEY = "skilltrack-name";

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
            <h3 class="skill-name">
                <span class="dot" style="background-color: ${skill.color}"></span>
                ${skill.name}
            </h3>
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

// FILLS THE FEATURED CARD WITH THE MOST PRACTISED SKILL. UNLIKE RENDERSKILLS, THIS ONE DOESN'T BUILD HTML — THE CARD ALREADY EXISTS IN THE PAGE WITH ITS SVG RING, SO IT ONLY UPDATES THE VALUES INSIDE IT.
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

    const last = getLastSession(sessions);

    if (last === null) {
        document.querySelector(".featured-last").textContent = "No sessions yet";
    } else {
        document.querySelector(".featured-last").textContent =
            "Last session: " + formatRelativeDate(last.date) + " — " + formatDuration(last.durationMinutes);
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

// RETURNS THE MOST RECENT SESSION OF A SKILL, OR NULL WHEN THERE ARE NONE. COPIES THE LIST BEFORE SORTING SO THE ORDER INSIDE DATA IS NEVER TOUCHED.
function getLastSession(sessions) {
    if (sessions.length === 0) {
        return null;
    }

    const sorted = sessions.slice();

    sorted.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    return sorted[0];
}

// TURNS A DATE INTO FRIENDLY TEXT — "TODAY", "YESTERDAY", "5 DAYS AGO". PEOPLE READ RECENCY FASTER THAN THEY READ A CALENDAR DATE.
function formatRelativeDate(date) {
    const today = new Date().toISOString().slice(0, 10);
    const diff = (new Date(today) - new Date(date)) / ONE_DAY_MS;

    if (diff === 0) {
        return "Today";
    } else if (diff === 1) {
        return "Yesterday";
    } else {
        return diff + " days ago";
    }
}

// PICKS THE GREETING FROM THE CLOCK. THE CUT-OFFS ARE ARBITRARY BUT MATCH WHAT MOST APPS DO.
function getGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) {
        return "Good morning";
    } else if (hour < 18) {
        return "Good afternoon";
    } else {
        return "Good evening";
    }
}

// COUNTS HOW MANY DIFFERENT SKILLS WERE PRACTISED TODAY. USES A SET SO TWO SESSIONS OF THE SAME SKILL ONLY COUNT ONCE.
function countSkillsPracticedToday(sessions) {
    const today = new Date().toISOString().slice(0, 10);

    const todaySessions = sessions.filter(function (session) {
        return session.date === today;
    });

    const skillIds = todaySessions.map(function (session) {
        return session.skillId;
    });

    return new Set(skillIds).size;
}

// READS THE USER'S NAME, ASKING FOR IT ON THE FIRST VISIT. KEPT UNDER ITS OWN KEY SO CLEARING THE PRACTICE DATA DOESN'T WIPE IT.
function getUserName() {
    let name = localStorage.getItem(NAME_KEY);

    if (name === null || name === "") {
        name = prompt("What's your name?");

        if (name === null || name === "") {
            name = "there";
        }

        localStorage.setItem(NAME_KEY, name);
    }

    return name;
}

// FILLS THE GREETING LINE. CHANGES WITH THE TIME OF DAY AND WITH TODAY'S ACTIVITY, SO THE PAGE READS DIFFERENTLY ON EACH VISIT.
function renderGreeting(data) {
    const name = getUserName();
    const count = countSkillsPracticedToday(data.sessions);
    const sub = document.querySelector(".greeting-sub");

    document.querySelector(".greeting-title").textContent = getGreeting() + ", " + name;
    document.querySelector(".avatar").textContent = getInitials(name);

    if (count === 0) {
        sub.textContent = "No practice logged today. Ready to start?";
    } else if (count === 1) {
        sub.textContent = "You've practiced 1 skill today. Keep it up!";
    } else {
        sub.textContent = "You've practiced " + count + " skills today. Keep it up!";
    }
}

// TURNS A NAME INTO UP TO TWO INITIALS FOR THE AVATAR. "TIAGO GREGORI" BECOMES "TG"; A SINGLE NAME GIVES JUST ITS FIRST LETTER.
function getInitials(name) {
    const parts = name.trim().split(" ");
    let initials = parts[0].charAt(0);

    if (parts.length > 1) {
        initials = initials + parts[parts.length - 1].charAt(0);
    }

    return initials.toUpperCase();
}

// FILLS THE SKILL DROPDOWN AND WIRES THE DIALOG: OPENING, CANCELLING AND SAVING. RUNS ONCE — EVENT LISTENERS ONLY NEED REGISTERING A SINGLE TIME.
function setupLogDialog(data) {
    const dialog = document.querySelector("#log-dialog");
    const select = document.querySelector("#log-skill");
    let options = "";

    for (let i = 0; i < data.skills.length; i++) {
        const skill = data.skills[i];
        options = options + `<option value="${skill.id}">${skill.name}</option>`;
    }

    select.innerHTML = options;

    document.querySelector("#log-open").addEventListener("click", function () {
        document.querySelector("#log-date").value = new Date().toISOString().slice(0, 10);
        dialog.showModal();
    });

    document.querySelector("#log-cancel").addEventListener("click", function () {
        dialog.close();
    });

    const form = document.querySelector(".log-form");
    const error = document.querySelector(".log-error");

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const minutes = parseDuration(document.querySelector("#log-duration").value);
        const date = document.querySelector("#log-date").value;
        const today = new Date().toISOString().slice(0, 10);

        if (minutes === null || minutes < 1) {
            error.textContent = "Enter a duration like 45, 1h 30m or 1.5";
            error.hidden = false;
            return;
        }

        if (date > today) {
            error.textContent = "You can't log a session in the future.";
            error.hidden = false;
            return;
        }

        let notes = document.querySelector("#log-notes").value.trim();

        if (notes === "") {
            notes = null;
        }

        data.sessions.push({
            id: "s-" + Date.now(),
            skillId: document.querySelector("#log-skill").value,
            durationMinutes: minutes,
            date: date,
            notes: notes,
            createdAt: new Date().toISOString()
        });

        error.hidden = true;
        saveData(data);
        renderAll(data);
        form.reset();
        dialog.close();
    });
}

// TURNS WHAT THE USER TYPED INTO MINUTES. ACCEPTS "45", "1H 30M" AND "1.5". A DECIMAL MEANS HOURS, A WHOLE NUMBER MEANS MINUTES. RETURNS NULL WHEN THE TEXT MAKES NO SENSE, SO THE CALLER CAN SHOW AN ERROR.
function parseDuration(text) {
    const clean = text.trim().toLowerCase();

    if (clean === "") {
        return null;
    }

    if (clean.includes("h")) {
        const parts = clean.split("h");
        const hours = Number(parts[0]);
        const rest = parts[1].replace("m", "").trim();
        let minutes = 0;

        if (rest !== "") {
            minutes = Number(rest);
        }
        if (isNaN(hours) || isNaN(minutes)) {
            return null;
        }

        return Math.round(hours * 60 + minutes);
    }

    if (clean.includes("m")) {
        const minutes = Number(clean.replace("m", "").trim());

        if (isNaN(minutes)) {
            return null;
        }

        return Math.round(minutes);
    }

    const value = Number(clean);

    if (isNaN(value)) {
        return null;
    }

    if (clean.includes(".")) {
        return Math.round(value * 60);
    }

    return Math.round(value);
}

// FORMATS A DURATION FOR DISPLAY. UNDER AN HOUR STAYS IN MINUTES; ABOVE THAT READS AS HOURS, SINCE "600 MIN" MAKES PEOPLE DO ARITHMETIC.
function formatDuration(minutes) {
    if (minutes < 60) {
        return minutes + " min";
    }

    const hours = minutes / 60;

    if (hours === Math.round(hours)) {
        return hours + "h";
    }

    return hours.toFixed(1) + "h";
}

// FINDS A SKILL BY ITS ID. SESSIONS ONLY STORE THE ID, SO EVERY PLACE THAT SHOWS A SESSION NEEDS THIS LOOKUP.
function getSkillById(skills, id) {
    return skills.find(function (skill) {
        return skill.id === id;
    });
}

// DRAWS THE MOST RECENT SESSIONS, NEWEST FIRST. LIMITED TO A HANDFUL BECAUSE THE DASHBOARD IS A SUMMARY, NOT AN ARCHIVE.
function renderSessions(data, limit) {
    const list = document.querySelector(".sessions-list");
    const sessions = data.sessions.slice();

    sessions.sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    const recent = sessions.slice(0, limit);
    let html = "";

    for (let i = 0; i < recent.length; i++) {
        const session = recent[i];
        const skill = getSkillById(data.skills, session.skillId);
        let notes = session.notes;

        if (notes === null) {
            notes = "";
        }

        html = html + `
        <li class="session-row">
            <span class="dot" style="background-color: ${skill.color}"></span>
            <span class="session-skill">${skill.name}</span>
            <span class="session-notes">${notes}</span>
            <span class="session-duration">${formatDuration(session.durationMinutes)}</span>
            <span class="session-date">${formatRelativeDate(session.date)}</span>
        </li>`;
    }

    list.innerHTML = html;
}

// REDRAWS THE WHOLE DASHBOARD FROM THE CURRENT DATA. CALLED ON FIRST LOAD AND AGAIN AFTER EVERY CHANGE, SO THE SCREEN NEVER DRIFTS FROM WHAT'S STORED.
function renderAll(data) {
    const sorted = getSkillsByPractice(data);

    renderSessions(data, 5);
    renderGreeting(data);
    renderFeatured(data, sorted[0]);
    renderSkills(data, sorted.slice(1, 4));
    renderHeatmap(data);
}

// ENTRY POINT — RUNS ONCE THE DATA IS READY.
initialData().then(function (data) {
    renderAll(data);
    setupLogDialog(data);
});
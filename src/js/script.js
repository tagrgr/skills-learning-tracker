const STORAGE_KEY = "skilltrack-data";

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored === "") {
        return null
    } else {
        return JSON.parse(stored);
    }
}

async function initialData() {
    let data = loadData();

    if (data === null) {
        const response = await fetch("../../data/sample-skills.json");
        data = await response.json();
        saveData(data);
    }

    return data;
}
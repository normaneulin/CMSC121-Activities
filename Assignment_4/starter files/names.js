// move Assignment_4 folder inside c:\xampp\htdocs\

"use strict";

(function () {

    const BASE_URL    = "http://localhost/Assignment_4/babynames/babynames.php";
    const BAR_WIDTH   = 50;
    const MAX_RANK    = 1000;
    const BAR_DIVISOR = 4; 
    const HOT_CUTOFF  = 10;

    /**
     * Returns the element with the given id.
     * @param {string} elemId
     * @returns {HTMLElement}
     */
    function id(elemId) {
        return document.getElementById(elemId);
    }

    /**
     * Returns the first element matching a CSS selector.
     * @param {string} selector
     * @returns {HTMLElement}
     */
    function qs(selector) {
        return document.querySelector(selector);
    }

    /**
     * Makes an element visible by clearing its inline display style.
     * @param {string} elemId
     */
    function show(elemId) {
        id(elemId).style.display = "";
    }

    /**
     * Hides an element by setting its inline display style to none.
     * @param {string} elemId
     */
    function hide(elemId) {
        id(elemId).style.display = "none";
    }

    function hideAllLoading() {
        hide("loadingnames");
        hide("loadingmeaning");
        hide("loadinggraph");
        hide("loadingcelebs");
    }

    /**
     * appends a styled error paragraph to #errors and hides all spinners
     * @param {string} message - human-readable description of the problem
     */
    function showError(message) {
        hideAllLoading();
        const p = document.createElement("p");
        p.textContent = "Error: " + message;
        p.classList.add("errormsg");
        id("errors").appendChild(p);
    }

    /**
     * checks the HTTP response status, if not OK (2xx), throws an error
     * otherwise returns the response for further chaining
     * @param {Response} resp
     * @returns {Response}
     */
    function checkStatus(resp) {
        if (!resp.ok) {
            throw new Error("HTTP " + resp.status + " " + resp.statusText);
        }
        return resp;
    }

    function init() {
        loadNameList();
        id("search").addEventListener("click", onSearch);
    }

    function loadNameList() {
        show("loadingnames");
        fetch(BASE_URL + "?type=list")
            .then(checkStatus)
            .then(function (resp) { return resp.text(); })
            .then(populateNameList)
            .catch(function (err) {
                showError("Could not load name list: " + err.message);
            });
    }

    /**
     * fills #allnames with one <option> per name returned by the server,
     * then enables the select element and hides the loading spinner.
     * @param {string} text - newline-separated list of names
     */
    function populateNameList(text) {
        const select = id("allnames");
        const names  = text.trim().split("\n");

        names.forEach(function (name) {
            const trimmed = name.trim();
            if (trimmed) {
                const opt       = document.createElement("option");
                opt.value       = trimmed;
                opt.textContent = trimmed;
                select.appendChild(opt);
            }
        });

        select.disabled = false;
        hide("loadingnames");
    }

    function onSearch() {
        const name   = id("allnames").value;
        const gender = qs("input[name='gender']:checked").value.toLowerCase();

        if (!name) {
            return;
        }
        clearResults();
        show("resultsarea");
        show("loadingmeaning");
        show("loadinggraph");
        show("loadingcelebs");
        fetchMeaning(name);
        fetchRank(name, gender);
        fetchCelebs(name, gender);
    }

    function clearResults() {
        id("meaning").innerHTML = "";
        id("graph").innerHTML   = "";
        id("celebs").innerHTML  = "";
        id("errors").innerHTML  = "";
        hide("norankdata");
        hide("nocelebdata");
    }


    /**
     * fetches the HTML meaning fragment for the given name from the server
     * and injects it into #meaning, hides #loadingmeaning when done
     * @param {string} name
     */
    function fetchMeaning(name) {
        fetch(BASE_URL + "?type=meaning&name=" + name)
            .then(checkStatus)
            .then(function (resp) { return resp.text(); })
            .then(function (html) {
                id("meaning").innerHTML = html;
                hide("loadingmeaning");
            })
            .catch(function (err) {
                hide("loadingmeaning");
                showError("Could not load meaning data: " + err.message);
            });
    }

    /**
     * fetches XML ranking data for the given name+gender combination
     * a 410 response is expected and handled by showing #norankdata.
     * all other non-OK responses are treated as errors via showError().
     * hides #loadinggraph when finished
     * @param {string} name
     * @param {string} gender  "male" or "female"
     */
    function fetchRank(name, gender) {
        fetch(BASE_URL + "?type=rank&name=" + name + "&gender=" + gender)
            .then(function (resp) {
                // 410 = no ranking data for this name/gender – not a real error
                if (resp.status === 410) {
                    hide("loadinggraph");
                    show("norankdata");
                    return null;
                }
                // For all other statuses, check OK then return text
                if (!resp.ok) {
                    throw new Error("HTTP " + resp.status + " " + resp.statusText);
                }
                return resp.text();
            })
            .then(function (xmlText) {
                if (!xmlText) { return; }
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "application/xml");
                buildGraph(xmlDoc);
                hide("loadinggraph");
            })
            .catch(function (err) {
                hide("loadinggraph");
                showError("Could not load ranking data: " + err.message);
            });
    }

    /**
     * @param {Document} xmlDoc 
     */
    function buildGraph(xmlDoc) {
        const ranks  = xmlDoc.getElementsByTagName("rank");
        const table  = id("graph");
        const rowYr  = document.createElement("tr");   // year-header row
        const rowBar = document.createElement("tr");   // bar row

        Array.from(ranks).forEach(function (rankEl) {
            const year  = rankEl.getAttribute("year");
            const value = parseInt(rankEl.textContent, 10);
            const th = document.createElement("th");
            th.textContent = year;
            rowYr.appendChild(th);

            const td  = document.createElement("td");
            const bar = document.createElement("div");
            const height = (value === 0)
                ? 0
                : parseInt((MAX_RANK - value) / BAR_DIVISOR, 10);

            bar.style.height = height + "px";
            bar.style.width  = BAR_WIDTH + "px";
            td.style.width   = (BAR_WIDTH + 1) + "px";
            bar.classList.add("rankbar");
            if (value >= 1 && value <= HOT_CUTOFF) {
                bar.classList.add("hotrank");
            }
            bar.textContent = value;

            td.appendChild(bar);
            rowBar.appendChild(td);
        });

        table.appendChild(rowYr);
        table.appendChild(rowBar);
    }

    /**
     * fetches JSON celebrity data for the given name+gender and passes the parsed object to buildCelebList, hides #loadingcelebs when done
     * @param {string} name
     * @param {string} gender  "male" or "female"
     */
    function fetchCelebs(name, gender) {
        fetch(BASE_URL + "?type=celebs&name=" + name + "&gender=" + gender)
            .then(checkStatus)
            .then(function (resp) { return resp.json(); })
            .then(buildCelebList)
            .catch(function (err) {
                hide("loadingcelebs");
                showError("Could not load celebrity data: " + err.message);
            });
    }

    /**
     * populates #celebs with one <li> per actor in the JSON data
     * each item shows "FirstName LastName (N films)"
     * if the actors array is empty, shows #nocelebdata instead
     * @param {Object} data - parsed JSON response from the celebs endpoint
     */
    function buildCelebList(data) {
        hide("loadingcelebs");
        const actors = data.actors;

        if (!actors || actors.length === 0) {
            show("nocelebdata");
            return;
        }

        const ul = id("celebs");
        actors.forEach(function (actor) {
            const li = document.createElement("li");
            li.textContent =
                actor.firstName + " " + actor.lastName +
                " (" + actor.filmCount + " films)";
            ul.appendChild(li);
        });
    }

    window.addEventListener("load", init);
}());
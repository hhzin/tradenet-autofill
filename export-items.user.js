// ==UserScript==
// @name         Tradenet HS Helper Export
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Save HS items and auto-run the HS-search → select → description → price → currency workflow. Use HS description as item name.
// @author       uzi
// @updateURL    https://raw.githubusercontent.com/hhzin/tradenet-autofill/main/export-items.user.js
// @downloadURL  https://raw.githubusercontent.com/hhzin/tradenet-autofill/main/export-items.user.js
// @match        https://oversea.myanmartradenet.com/ExportLicence*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=myanmartradenet.com
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /**********************************
     * Utility
     **********************************/
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    function triggerChange(el) {
        if (!el) return;
        el.dispatchEvent(new Event('change', { bubbles:true }));
        if (window.$) {
            try { $(el).trigger('change').trigger('changed.bs.select'); } catch(e){}
        }
    }

    function isVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
    }

    /**********************************
     * Storage
     **********************************/
    const STORAGE_KEY = "tn_hs_items_v21";
    const loadItems = () => { try { return JSON.parse(GM_getValue(STORAGE_KEY, "{}")); } catch { return {}; } };
    const saveItems = (obj) => GM_setValue(STORAGE_KEY, JSON.stringify(obj));

    /**********************************
     * Waiting logic
     **********************************/
    async function waitForDescriptionReady(selector="#Description", timeout=30000, interval=200) {
        const start = Date.now();
        const first = document.querySelector(selector);

        if (!first) return null;
        if (first.tagName.toLowerCase() !== "select") return first;

        let oldFirst = first.options?.[0]?.value || "";
        let prevLen = first.options?.length || 0;
        let stable = 0;

        return new Promise(resolve => {
            (function tick() {
                const el = document.querySelector(selector);
                if (!el) return resolve(null);
                if (!el.options) return resolve(el);

                const len = el.options.length;
                const f = el.options?.[0]?.value || "";

                if (f && f !== oldFirst) return resolve(el);
                if (el.selectedIndex === 0 && len > 0) return resolve(el);

                if (len === prevLen) stable++; else stable = 0;
                prevLen = len;

                if (stable >= 3 && len > 0) return resolve(el);
                if (Date.now() - start > timeout) return resolve(el);

                setTimeout(tick, interval);
            })();
        });
    }

    /**********************************
     * Popup closing
     **********************************/
    async function closeHsPopup() {
        const tryClose = () => {
            let b = document.querySelector('button.close[data-dismiss="modal"]');
            if (b) { b.click(); return true; }

            const all = [...document.querySelectorAll("button.close")];
            const vis = all.find(x => isVisible(x));
            if (vis) { vis.click(); return true; }

            if (window.$) {
                try { $(".modal").modal("hide"); return true; } catch {}
            }
            return false;
        };

        for (let i=0;i<15;i++){
            if (tryClose()) return;
            await sleep(150);
        }
    }

    /**********************************
     * Run HS automation
     **********************************/
    async function runHsWorkflow(item) {
        if (!item) return;

        const popupBtn = document.querySelector("#btnSearch");
        if (!popupBtn) return alert("HS search button not found.");
        popupBtn.click();
        await sleep(300);

        const kw = document.querySelector("#Keywords");
        if (!kw) return alert("HS input not found.");
        kw.value = item.hsCode;
        triggerChange(kw);

        const btn = document.querySelector("#btnHSSearch");
        if (!btn) return alert("Popup search button missing.");
        btn.click();

        await sleep(1200);

        const firstRow = document.querySelector("#tblHSCode tbody tr td.sorting_1");
        if (!firstRow) return alert("No HS result found.");
        firstRow.click();

        await sleep(300);
        const sel = document.querySelector("#tblHSCode tbody tr button#btnSelect");
        if (!sel) return alert("Select button missing.");
        sel.click();

        await sleep(200);
        await closeHsPopup();

        await waitForDescriptionReady("#Description");

        const descField = document.querySelector("#Description");
        const want = (item.description||"").trim();

        if (descField) {
            if (descField.tagName.toLowerCase()==="select") {
                const opt = [...descField.options].find(o => o.textContent.trim() === want);
                if (opt) { opt.selected = true; triggerChange(descField); }
            } else {
                descField.value = want;
                triggerChange(descField);
            }
        }

        // NEW — Fill unit
        const unitSel = document.querySelector("#UnitId");
        if (unitSel) {
            let matched = false;

            if (item.unitValue) {
                const opt = unitSel.querySelector(`option[value="${item.unitValue}"]`);
                if (opt){ opt.selected=true; matched=true; }
            }
            if (!matched && item.unitText){
                const byText = [...unitSel.options].find(o => o.textContent.trim() === item.unitText.trim());
                if (byText){ byText.selected=true; matched=true; }
            }
            if (matched){
                triggerChange(unitSel);
                if (window.$) $("#UnitId").selectpicker("refresh");
            }
        }

        const price = document.querySelector("#Price");
        if (price){ price.value=item.price; triggerChange(price); }

        const currSel = document.querySelector("#CurrencyId");
        if (currSel){
            let opt = currSel.querySelector(`option[value="${item.currency}"]`);
            if (!opt && item.currencyText){
                opt = [...currSel.options].find(o => o.textContent.trim()===item.currencyText.trim());
            }
            if (opt){ opt.selected=true; triggerChange(currSel); }
        }
    }

    /**********************************
     * DELETE POPUP MENU
     **********************************/
    function chooseItemToDelete(items) {
        return new Promise(resolve => {
            const wrap = document.createElement("div");
            wrap.style = `
                position: fixed;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 16px;
                border: 1px solid #888;
                width: 260px;
                z-index: 999999999;
                border-radius: 6px;
                font-family: Arial;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            `;

            wrap.innerHTML = `
                <div style="margin-bottom:8px;font-weight:bold;">Delete Saved Item</div>
                <select id="delSel" style="width:100%;padding:6px;margin-bottom:12px;">
                    <option value="">Choose item...</option>
                    ${Object.keys(items)
                        .map(k => `<option value="${k.replace(/"/g,'&quot;')}">${k}</option>`)
                        .join("")}

                </select>
                <div style="display:flex;justify-content:space-between;">
                    <button id="delCancel" style="padding:6px;">Cancel</button>
                    <button id="delOK" style="padding:6px;">Delete</button>
                </div>
            `;

            document.body.appendChild(wrap);

            wrap.querySelector("#delCancel").onclick = ()=>{
                wrap.remove();
                resolve(null);
            };
            wrap.querySelector("#delOK").onclick = ()=>{
                const v = wrap.querySelector("#delSel").value;
                wrap.remove();
                resolve(v||null);
            };
        });
    }

    /**********************************
     * UI display logic — ONLY show panel on HS section
     **********************************/
    function togglePanelVisibility() {
        const panel = document.getElementById("hsPanel");
        if (!panel) return;

        const hsBtn = document.querySelector("#btnSearch");
        if (isVisible(hsBtn)) panel.style.display = "block";
        else panel.style.display = "none";
    }

    /**********************************
     * UI Panel
     **********************************/
    function createPanel() {
        const panel = document.createElement("div");
        panel.id = "hsPanel";
        panel.style = `
            position: fixed;
            top: 110px;
            right: 40px;
            width: 300px;
            background: #fff;
            border: 1px solid #aaa;
            border-radius: 6px;
            z-index: 999999;
            font-family: Arial;
        `;

        panel.innerHTML = `
            <div id="hsHeader" style="cursor:move;padding:6px 8px;background:#f0f0f0;border-bottom:1px solid #ccc;display:flex;justify-content:space-between;">
                <div style="font-weight:bold;">HS Item Helper</div>
                <button id="hsCollapseBtn" style="padding:2px 8px;">−</button>
            </div>

            <div id="hsContents" style="padding:8px; display:none;">
                <input id="hsSearchBox" placeholder="Search saved..." style="width:100%;padding:6px;margin-bottom:8px;" />
                <div id="hsResults" style="max-height:200px;overflow:auto;border:1px solid #eee;padding:6px;margin-bottom:8px;"></div>

                <div style="display:flex;gap:8px;">
                    <button id="btnSaveCurrent" style="flex:1;padding:6px;">Save Current</button>
                    <button id="btnDeleteItem" style="flex:1;padding:6px;">Delete</button>
                </div>

                <div id="hsMsg" style="margin-top:8px;font-size:12px;color:#444;"></div>
            </div>
        `;

        document.body.appendChild(panel);

        // Start minimized but DO NOT modify the collapse handler logic
        const body = panel.querySelector("#hsContents");
        const btn = panel.querySelector("#hsCollapseBtn");
        body.style.display = "none";
        btn.textContent = "+";
        panel.dataset.collapsed = "true";

        makeMovable(panel, panel.querySelector("#hsHeader"));
        setupCollapse(panel);

        return panel;
    }

    function makeMovable(panel, handle) {
        let drag=false, offsetX=0, offsetY=0;

        handle.addEventListener("mousedown", e=>{
            drag=true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
            e.preventDefault();
        });

        document.addEventListener("mousemove", e=>{
            if (!drag) return;
            panel.style.left = (e.clientX-offsetX)+"px";
            panel.style.top  = (e.clientY-offsetY)+"px";
        });

        document.addEventListener("mouseup", ()=>drag=false);
    }

    function setupCollapse(panel) {
    const btn = panel.querySelector("#hsCollapseBtn");
    const body = panel.querySelector("#hsContents");

    // Read initial state
    let collapsed = panel.dataset.collapsed === "true";

    btn.onclick = () => {
        collapsed = !collapsed;
        panel.dataset.collapsed = collapsed ? "true" : "false";

        body.style.display = collapsed ? "none" : "block";
        btn.textContent = collapsed ? "+" : "−";
    };
}

    /**********************************
     * Supporting UI logic
     **********************************/
    function showMessage(msg) {
        const el=document.getElementById("hsMsg");
        if (!el) return;
        el.textContent = msg;
        setTimeout(()=>{ if(el.textContent===msg) el.textContent=""; },4000);
    }

    function refreshList() {
        const items = loadItems();
        const q = document.getElementById("hsSearchBox").value.toLowerCase();
        const box = document.getElementById("hsResults");

        box.innerHTML = "";

        Object.keys(items)
            .filter(name=>name.toLowerCase().includes(q))
            .forEach(name=>{
                const d=document.createElement("div");
                d.style = "padding:4px;cursor:pointer;border-bottom:1px solid #eee;";
                d.textContent = name;
                d.onclick = async()=>{
                    showMessage("Running: "+name);
                    await runHsWorkflow(items[name]);
                    showMessage("Completed: "+name);
                };
                box.appendChild(d);
            });
    }

    function saveCurrent() {
        const hs = document.querySelector("#HSCode")?.value;
        if (!hs) return showMessage("No HS code selected.");

        let descField = document.querySelector("#Description");
        let desc = "";

        if (descField?.tagName.toLowerCase()==="select") {
            desc = descField.options[descField.selectedIndex]?.textContent.trim();
        } else {
            desc = descField?.value.trim() || "";
        }
        if (!desc) return showMessage("No description.");

        const price = document.querySelector("#Price")?.value || "";
        const currency = document.querySelector("#CurrencyId")?.value || "";

        let unitValue="",unitText="";
        const u = document.querySelector("#UnitId");
        if (u){
            const opt = u.options[u.selectedIndex];
            if (opt){
                unitValue = opt.value;
                unitText = opt.textContent.trim();
            }
        }

        const items = loadItems();
        items[desc] = {
            hsCode: hs,
            description: desc,
            price,
            currency,
            unitValue,
            unitText
        };
        saveItems(items);

        showMessage("Saved: "+desc);
        refreshList();
    }

    async function deleteItem() {
        const items = loadItems();
        const names = Object.keys(items);
        if (!names.length) return alert("No saved items.");

        // ask user which one to delete
        const pick = await chooseItemToDelete(items);
        if (!pick) return; // cancelled

        // ensure it exists locally
        if (!items.hasOwnProperty(pick)) {
            showMessage("Item not found: " + pick);
            return;
        }

        // remove and save
        delete items[pick];
        saveItems(items);

        // small pause to allow storage to settle (avoids race with other scripts)
        await new Promise(r => setTimeout(r, 120));

        // verify deletion actually persisted
        const now = loadItems();
        if (now && now.hasOwnProperty(pick)) {
            // deletion did not persist — likely another script overwrote storage.
            alert(
                "Deletion failed: saved data still contains \"" + pick + "\".\n\n" +
                "Likely cause: another script instance is also using the same storage key and overwrote your change.\n\n" +
                "Please check Tampermonkey for duplicate scripts with the same name/metadata or scripts using the storage key: " + STORAGE_KEY
            );
            // still refresh list from the currently loaded storage so UI matches reality
            refreshList();
            return;
        }

        // success
        refreshList();
        showMessage("Deleted: " + pick);
    }


    /**********************************
     * INIT
     **********************************/
    function init() {
        createPanel();

        document.getElementById("hsSearchBox").addEventListener("input", refreshList);
        document.getElementById("btnSaveCurrent").onclick = saveCurrent;
        document.getElementById("btnDeleteItem").onclick = deleteItem;

        refreshList();
        togglePanelVisibility();
        setInterval(togglePanelVisibility, 800);
    }

    init();

})();

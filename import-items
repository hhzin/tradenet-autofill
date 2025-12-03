// ==UserScript==
// @name         Tradenet HS Helper Import
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Save HS items and auto-run the HS-search → select → description → unit (text) → price → quantity → currency → Add workflow. Movable + collapsible UI.
// @author       uzi
// @updateURL    https://raw.githubusercontent.com/hhzin/tradenet-autofill/main/import-items.js
// @downloadURL  https://raw.githubusercontent.com/hhzin/tradenet-autofill/main/import-items.js
// @match        https://oversea.myanmartradenet.com/ImportLicence*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=myanmartradenet.com
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /* ---------- small helpers ---------- */
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    function triggerChange(el) {
        if (!el) return;
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
        if (window.$) {
            try { $(el).trigger('change'); $(el).trigger('changed.bs.select'); } catch(e){}
        }
    }
    function waitForSelector(selector, timeout = 15000, interval = 150) {
        const start = Date.now();
        return new Promise(resolve => {
            (function check() {
                const el = document.querySelector(selector);
                if (el) return resolve(el);
                if (Date.now() - start > timeout) return resolve(null);
                setTimeout(check, interval);
            })();
        });
    }
    async function waitForAmountUpdate(timeout = 8000, interval = 120) {
        const amountEl = document.querySelector('#Amount');
        if (!amountEl) return;

        let start = Date.now();
        let last = amountEl.value;

        const price = document.querySelector('#Price');
        const qty = document.querySelector('#Quantity');
        if (price) price.dispatchEvent(new Event('blur', { bubbles: true }));
        if (qty) qty.dispatchEvent(new Event('blur', { bubbles: true }));

        return new Promise(resolve => {
            (function check() {
                const current = amountEl.value;

                if (current !== "0" && current !== "" && current !== last) {
                    return resolve(true);
                }

                last = current;

                if (Date.now() - start > timeout) {
                    console.warn("waitForAmountUpdate timeout — continuing anyway");
                    return resolve(false);
                }

                setTimeout(check, interval);
            })();
        });
    }

    /* ---------- storage ---------- */
    const STORAGE_KEY = 'tn_import_hs_items_v1';
    function loadItems() {
        try { return JSON.parse(GM_getValue(STORAGE_KEY, '{}')); }
        catch(e) { return {}; }
    }
    function saveItems(obj) {
        GM_setValue(STORAGE_KEY, JSON.stringify(obj));
    }

    /* ---------- close HS popup ---------- */
    async function closeHsPopup() {
        const tryClose = () => {
            const btn = document.querySelector('button.close[data-dismiss="modal"]');
            if (btn && btn.offsetParent !== null) { btn.click(); return true; }

            const all = [...document.querySelectorAll('button.close')];
            const vis = all.find(b => {
                const r = b.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
            });
            if (vis) { vis.click(); return true; }

            if (window.$) {
                try { $('.modal').modal('hide'); return true; } catch(e){}
            }
            return false;
        };

        for (let i=0;i<20;i++){
            if (tryClose()) return true;
            await sleep(150);
        }
        return false;
    }

    /* ---------- HS workflow ---------- */
    async function runHsWorkflow(item) {
        if (!item) return;

        const btnSearch = document.querySelector('#btnSearch');
        if (!btnSearch) { alert('Cannot find "Search HS Code" button'); return; }
        btnSearch.click();
        await sleep(250);

        const inputHS = await waitForSelector('#Keywords', 8000);
        if (!inputHS) { alert('HS keyword input not found'); return; }
        inputHS.value = item.hsCode || '';
        triggerChange(inputHS);

        const btnSearchHS = document.querySelector('#btnHSSearch');
        if (!btnSearchHS) { alert('Cannot find popup HS search button'); return; }
        btnSearchHS.click();

        await waitForSelector('#tblHSCode tbody tr td.sorting_1', 12000);
        await sleep(300);

        const firstRowCell = document.querySelector('#tblHSCode tbody tr td.sorting_1');
        if (!firstRowCell) { alert('No HS results found'); return; }
        try { firstRowCell.click(); } catch(e){}

        await sleep(250);

        const row = firstRowCell.closest('tr');
        let hsCodeFromRow = '';
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells.length > 1) {
                hsCodeFromRow = (cells[1].textContent || '').trim();
            }
        }

        let selectBtn = row ? row.querySelector('button#btnSelect') : null;
        if (!selectBtn) selectBtn = document.querySelector('#tblHSCode button#btnSelect');
        if (!selectBtn) { alert('Select button not found'); return; }
        selectBtn.click();

        await sleep(200);
        await closeHsPopup();

        const descEl = await waitForSelector('#Description', 8000);
        if (descEl) {
            descEl.value = item.description || '';
            triggerChange(descEl);
        }

        const unitSel = document.querySelector('#UnitId');
        if (unitSel && item.unitText) {
            let opt = Array.from(unitSel.options)
                .find(o => o.textContent.trim() === item.unitText.trim());
            if (!opt && item.unitValue) {
                opt = unitSel.querySelector(`option[value="${item.unitValue}"]`);
            }
            if (opt) {
                opt.selected = true;
                triggerChange(unitSel);
                if (window.$) try { $('#UnitId').selectpicker('refresh'); } catch(e){}
            }
        }

        const priceEl = document.querySelector('#Price');
        if (priceEl) {
            priceEl.value = item.price || '';
            triggerChange(priceEl);
        }

        const qtyEl = document.querySelector('#Quantity');
        let finalQty = item.quantity;
        if (!finalQty) {
            finalQty = prompt('Enter quantity to add:', item.quantity || '');
            if (finalQty === null) return;
        }
        if (qtyEl) {
            qtyEl.value = finalQty;
            triggerChange(qtyEl);
        }

        const currSel = document.querySelector('#CurrencyId');
        if (currSel) {
            let found = false;
            if (item.currencyValue) {
                let opt = currSel.querySelector(`option[value="${item.currencyValue}"]`);
                if (opt) { opt.selected = true; found = true; }
            }
            if (!found && item.currencyText) {
                const opt2 = [...currSel.options]
                    .find(o => o.textContent.trim() === item.currencyText.trim());
                if (opt2) { opt2.selected = true; found = true; }
            }
            if (found) {
                triggerChange(currSel);
                if (window.$) try { $('#CurrencyId').selectpicker('refresh'); } catch(e){}
            }
        }

        await waitForAmountUpdate();

        const addBtn = document.querySelector('#btnAdd');
        if (addBtn) try { addBtn.click(); } catch(e){}

        await sleep(300);
        showMsg('Added item (HS: ' + (item.hsCode || hsCodeFromRow) + ')');
    }

    /* ---------- Panel (unchanged except: starts minimized) ---------- */
    function createPanel() {
        const existing = document.querySelector('#hsPanel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'hsPanel';
        panel.style.cssText = `
            position: fixed;
            top: 110px;
            right: 40px;
            width: 300px;
            background: #fff;
            border: 1px solid #aaa;
            border-radius: 6px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;

        panel.innerHTML = `
            <div id="hsHeader" style="cursor:grab; padding:8px; background:#f0f0f0;
                border-bottom:1px solid #ccc; display:flex; justify-content:space-between;">
                <div style="font-weight:700;">HS Item Helper</div>
                <button id="hsCollapseBtn" style="padding:2px 8px; cursor:pointer;">+</button>
            </div>

            <div id="hsContents" style="padding:8px; display:none;">
                <input id="hsSearchBox" placeholder="Search saved items..."
                    style="width:100%; padding:6px; margin-bottom:8px;" />

                <div id="hsResults"
                     style="max-height:220px; overflow:auto; border:1px solid #eee;
                            padding:6px; margin-bottom:8px;"></div>

                <div style="display:flex; gap:8px;">
                    <button id="btnSaveCurrent" style="flex:1; padding:6px;">Save Current</button>
                    <button id="btnDeleteItem" style="flex:1; padding:6px;">Delete</button>
                </div>

                <div id="hsMsg" style="margin-top:8px; font-size:12px;"></div>
            </div>
        `;

        document.body.appendChild(panel);

        makeMovable(panel, panel.querySelector('#hsHeader'));
        setupCollapse(panel);
        return panel;
    }

    /* ---------- Movable panel ---------- */
    function makeMovable(panel, handle) {
        const rect = panel.getBoundingClientRect();
        if (!panel.style.left) panel.style.left = (window.innerWidth - rect.width - 60) + 'px';
        if (!panel.style.top)  panel.style.top  = rect.top + 'px';
        panel.style.right = 'auto';

        let dragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('pointerdown', ev => {
            if (ev.target.closest('#hsCollapseBtn')) return;

            dragging = true;
            handle.setPointerCapture(ev.pointerId);
            startX = ev.clientX;
            startY = ev.clientY;
            startLeft = parseInt(panel.style.left);
            startTop  = parseInt(panel.style.top);
            ev.preventDefault();
        });
        handle.addEventListener('pointermove', ev => {
            if (!dragging) return;
            panel.style.left = startLeft + (ev.clientX - startX) + 'px';
            panel.style.top  = startTop  + (ev.clientY - startY) + 'px';
        });
        handle.addEventListener('pointerup', ev => {
            dragging = false;
            try { handle.releasePointerCapture(ev.pointerId); } catch(e){}
        });
    }

    /* ---------- Collapse ---------- */
    function setupCollapse(panel) {
        const btn = panel.querySelector('#hsCollapseBtn');
        const contents = panel.querySelector('#hsContents');
        let collapsed = true;

        btn.addEventListener('click', () => {
            collapsed = !collapsed;
            contents.style.display = collapsed ? 'none' : 'block';
            btn.textContent = collapsed ? '+' : '−';
        });
    }

    /* ---------- Show message ---------- */
    function showMsg(msg, t=4000) {
        const el = document.getElementById('hsMsg');
        if (!el) return;
        el.textContent = msg;
        if (t) setTimeout(() => { if (el.textContent===msg) el.textContent=''; }, t);
    }

    /* ---------- Refresh list ---------- */
    function refreshList() {
        const items = loadItems();
        const q = (document.getElementById('hsSearchBox')?.value || '').toLowerCase();
        const container = document.getElementById('hsResults');
        if (!container) return;

        container.innerHTML = '';
        Object.keys(items)
            .filter(k => k.toLowerCase().includes(q))
            .forEach(name => {
                const item = items[name];
                const div = document.createElement('div');
                div.style = "padding:6px 4px; cursor:pointer; border-bottom:1px solid #eee; display:flex; justify-content:space-between;";
                div.textContent = name;
                div.onclick = () => runHsWorkflow(item);
                container.appendChild(div);
            });
    }

    /* ---------- Read form ---------- */
    function readCurrent() {
        const hs = (document.querySelector('#HSCode')?.value || '').trim();
        const desc = (document.querySelector('#Description')?.value || '').trim();

        const unitSel = document.querySelector('#UnitId');
        let unitText="", unitValue="";
        if (unitSel) {
            const opt = unitSel.options[unitSel.selectedIndex];
            if (opt) {
                unitText = opt.textContent.trim();
                unitValue = opt.value;
            }
        }

        return {
            hsCode: hs,
            description: desc,
            unitText,
            unitValue,
            price: (document.querySelector('#Price')?.value || '').trim(),
            quantity: (document.querySelector('#Quantity')?.value || '').trim(),
            currencyText: (() => {
                const s=document.querySelector('#CurrencyId');
                const o=s?s.options[s.selectedIndex]:null;
                return o?o.textContent.trim():"";
            })(),
            currencyValue: (() => {
                const s=document.querySelector('#CurrencyId');
                const o=s?s.options[s.selectedIndex]:null;
                return o?o.value:"";
            })()
        };
    }

    /* ---------- Save ---------- */
    function saveCurrent() {
        const cur = readCurrent();
        if (!cur.hsCode) return showMsg("No HS code detected.");
        if (!cur.description) return showMsg("No description present.");

        const suggested = cur.description;
        const name = prompt("Enter a save name for this item:", suggested);
        if (!name) return;

        const items = loadItems();
        items[name] = cur;
        saveItems(items);

        showMsg("Saved: " + name);
        refreshList();
    }

    /* ---------- DELETE (dropdown version) ---------- */
    async function deleteItem() {
        const items = loadItems();
        const names = Object.keys(items);
        if (!names.length) return alert("No saved items.");

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
        `;

        wrap.innerHTML = `
            <div style="margin-bottom:8px;font-weight:bold;">Delete Saved Item</div>
            <select id="delSel" style="width:100%;padding:6px;margin-bottom:12px;">
                <option value="">Choose item...</option>
                ${names.map(k=>`<option>${k}</option>`).join("")}
            </select>
            <div style="display:flex;justify-content:space-between;">
                <button id="delCancel" style="padding:6px;">Cancel</button>
                <button id="delOK" style="padding:6px;">Delete</button>
            </div>
        `;

        document.body.appendChild(wrap);

        return new Promise(resolve => {
            wrap.querySelector("#delCancel").onclick = () => {
                wrap.remove();
                resolve();
            };
            wrap.querySelector("#delOK").onclick = async () => {
                const pick = wrap.querySelector("#delSel").value;
                wrap.remove();
                if (!pick) return;

                if (!items.hasOwnProperty(pick)) {
                    showMsg("Item not found: " + pick);
                    return;
                }

                delete items[pick];
                saveItems(items);
                await sleep(120);

                refreshList();
                showMsg("Deleted: " + pick);
                resolve();
            };
        });
    }

    /* ---------- Auto-hide when HS button missing ---------- */
    function togglePanelVisibility() {
        const panel = document.getElementById("hsPanel");
        const btn = document.querySelector("#btnSearch");

        if (btn && btn.offsetParent !== null)
            panel.style.display = "block";
        else
            panel.style.display = "none";
    }

    /* ---------- init ---------- */
    function init() {
        createPanel();

        document.getElementById('hsSearchBox').addEventListener('input', refreshList);
        document.getElementById('btnSaveCurrent').addEventListener('click', saveCurrent);
        document.getElementById('btnDeleteItem').addEventListener('click', deleteItem);

        refreshList();

        togglePanelVisibility();
        setInterval(togglePanelVisibility, 600);
    }

    init();

})();

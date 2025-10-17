// ==UserScript==
// @name         AMQ Romaji Dropdown Sort
// @namespace    https://github.com/Mxyuki/AMQ-Scripts
// @version      1.2.2
// @description  Make your AMQ dropdown answer show Romaji first
// @author       Lycee
// @match        https://animemusicquiz.com/*
// ==/UserScript==

(function() {
    'use strict';

    let dropdownList = [];
    let isInitialized = false;

    function extractNamesFromCache(animeCache) {
        const romajiNames = new Set();
        const englishNames = new Set();

        for (const animeEntry of Object.values(animeCache)) {
            const names = animeEntry.names;
            if (!names?.length) continue;

            const jaNames = names.filter(n => n.language === 'JA');
            const enNames = names.filter(n => n.language === 'EN');

            for (const nameObj of jaNames) {
                if (nameObj.name) romajiNames.add(nameObj.name);
            }
            for (const nameObj of enNames) {
                if (nameObj.name && !romajiNames.has(nameObj.name)) {
                    englishNames.add(nameObj.name);
                }
            }
        }

        dropdownList = [...romajiNames, ...englishNames];
        console.log(`[AMQ Romaji+EN] Loaded ${romajiNames.size} Romaji + ${englishNames.size} English names (${dropdownList.length} total)`);

        forceUpdateAutoComplete();
    }

    function forceUpdateAutoComplete(retryCount = 0) {
        if (typeof quiz !== 'undefined' &&
            quiz.answerInput?.typingInput?.autoCompleteController) {
            const controller = quiz.answerInput.typingInput.autoCompleteController;
            controller.list = dropdownList;
            controller.newList();

            if (controller.awesomepleteInstance) {
                controller.awesomepleteInstance.sort = function() { return 0; };
            }

            console.log("[AMQ Romaji+EN] ✅ Forced list update - Romaji now appears first!");
            return;
        }

        if (retryCount === 0) {
            console.log("[AMQ Romaji+EN] Waiting for quiz to start...");

            if (typeof Listener !== 'undefined') {
                new Listener("quiz ready", () => {
                    setTimeout(() => {
                        if (quiz.answerInput?.typingInput?.autoCompleteController) {
                            const controller = quiz.answerInput.typingInput.autoCompleteController;
                            controller.list = dropdownList;
                            controller.newList();

                            if (controller.awesomepleteInstance) {
                                controller.awesomepleteInstance.sort = function() { return 0; };
                            }

                            console.log("[AMQ Romaji+EN] ✅ List updated on quiz ready - Romaji now appears first!");
                        }
                    }, 100);
                }).bindListener();
            }
        }
    }

    function waitFor(checkFn, maxAttempts = 60, description = 'dependency') {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            console.log(`[AMQ Romaji+EN] Waiting for ${description}...`);
            const interval = setInterval(() => {
                if (checkFn()) {
                    clearInterval(interval);
                    console.log(`[AMQ Romaji+EN] ✅ ${description} loaded`);
                    resolve();
                } else if (++attempts >= maxAttempts) {
                    clearInterval(interval);
                    reject(new Error(`Timeout waiting for ${description} (${maxAttempts * 250}ms)`));
                }
            }, 250);
        });
    }

    function hookAutoComplete() {
        const originalUpdateList = AutoCompleteController.prototype.updateList;

        AutoCompleteController.prototype.updateList = function() {
            console.log(`[AMQ Romaji+EN] updateList called, dropdownList.length = ${dropdownList.length}`);

            if (dropdownList.length === 0) {
                console.warn("[AMQ Romaji+EN] List not ready, using default");
                originalUpdateList.call(this);
                return;
            }

            if (this.version === null) {
                const listener = new Listener("get all song names", (payload) => {
                    this.version = payload.version;
                    this.list = dropdownList;
                    this.newList();

                    if (this.awesomepleteInstance) {
                        this.awesomepleteInstance.sort = function() { return 0; };
                        console.log("[AMQ Romaji+EN] Sort overridden in updateList (initial)");
                    }

                    listener.unbindListener();
                });

                listener.bindListener();
                socket.sendCommand({ type: 'quiz', command: 'get all song names' });
            } else {
                const listener = new Listener("update all song names", (payload) => {
                    this.version = payload.version;

                    if (payload.deleted.length + payload.new.length > 0) {
                        this.list = dropdownList;
                        this.newList();

                        if (this.awesomepleteInstance) {
                            this.awesomepleteInstance.sort = function() { return 0; };
                            console.log("[AMQ Romaji+EN] Sort overridden in updateList (update)");
                        }
                    }

                    listener.unbindListener();
                });

                listener.bindListener();
                socket.sendCommand({
                    type: 'quiz',
                    command: 'update all song names',
                    data: { currentVersion: this.version }
                });
            }
        };

        console.log("[AMQ Romaji+EN] AutoComplete hooked successfully");
    }

    async function initialize() {
        if (isInitialized) return;

        try {
            console.log('[AMQ Romaji+EN] Starting initialization...');

            await waitFor(() => typeof libraryCacheHandler !== 'undefined', 60, 'libraryCacheHandler');
            await waitFor(() => typeof AutoCompleteController !== 'undefined', 60, 'AutoCompleteController');
            await waitFor(() => typeof Listener !== 'undefined', 60, 'Listener');
            await waitFor(() => typeof socket !== 'undefined', 60, 'socket');

            hookAutoComplete();

            libraryCacheHandler.getCache((animeCache) => {
                if (!animeCache || Object.keys(animeCache).length === 0) {
                    console.warn("[AMQ Romaji+EN] Cache empty, retrying...");
                    setTimeout(() => libraryCacheHandler.getCache(extractNamesFromCache), 2000);
                    return;
                }
                extractNamesFromCache(animeCache);
                isInitialized = true;
            });

            console.log('[AMQ Romaji+EN] Script initialized successfully (Romaji First)');
        } catch (error) {
            console.error('[AMQ Romaji+EN] Initialization failed:', error);
            console.log('[AMQ Romaji+EN] Will retry in 5 seconds...');
            setTimeout(initialize, 5000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

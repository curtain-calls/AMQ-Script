// ==UserScript==
// @name         AMQ Romaji Dropdown Sort
// @namespace    https://github.com/curtain-calls/amqscript_romaji_sort
// @version      1.0
// @description  Make your AMQ dropdown answer show Romaji first
// @author       Lycee
// @match        https://animemusicquiz.com/*
// ==/UserScript==

(function() {
    'use strict';

    let dropdownList = [];
    let isInitialized = false;

    let romajiSet = new Set();
    let englishSet = new Set();
    let romajiCount = 0;

    function extractNamesFromCache(animeCache) {
        const romajiNames = new Set();
        const englishNames = new Set();

        // First pass: collect all JA and EN names separately
        for (const animeEntry of Object.values(animeCache)) {
            const names = animeEntry.names;
            if (!names?.length) continue;

            for (const nameObj of names) {
                if (!nameObj.name) continue;

                if (nameObj.language === 'JA') {
                    romajiNames.add(nameObj.name);
                } else if (nameObj.language === 'EN') {
                    englishNames.add(nameObj.name);
                }
            }
        }

        // Second pass: Promote English titles if they're prefixes of Romaji titles
        const promoted = new Set();
        for (const enTitle of englishNames) {
            for (const jaTitle of romajiNames) {
                // Check if any Romaji title starts with this English title
                if (jaTitle.startsWith(enTitle + ':') ||
                    jaTitle.startsWith(enTitle + ' ')) {
                    promoted.add(enTitle);
                    break;
                }
            }
        }

        // Remove promoted titles from English and add to Romaji
        for (const title of promoted) {
            englishNames.delete(title);
            romajiNames.add(title);
        }

        romajiSet = romajiNames;
        englishSet = englishNames;
        romajiCount = romajiNames.size;
        dropdownList = [...romajiNames, ...englishNames];
        console.log(`[Lycee Bot] Loaded ${romajiNames.size} Romaji (${promoted.size} promoted) + ${englishNames.size} English names (${dropdownList.length} total)`);

        forceUpdateAutoComplete();
    }

    function forceUpdateAutoComplete(retryCount = 0) {
        if (typeof quiz !== 'undefined' &&
            quiz.answerInput?.typingInput?.autoCompleteController) {
            const controller = quiz.answerInput.typingInput.autoCompleteController;
            controller.list = dropdownList;
            controller.newList();

            if (controller.awesomepleteInstance) {
                const instance = controller.awesomepleteInstance;
                instance._romajiSet = new Set(romajiSet);

                instance.sort = function(a, b) {
                    const romaji = instance._romajiSet;
                    const aStr = String(a);
                    const bStr = String(b);

                    const aIsRomaji = romaji.has(aStr);
                    const bIsRomaji = romaji.has(bStr);

                    // Romaji always comes first
                    if (aIsRomaji && !bIsRomaji) return -1;
                    if (!aIsRomaji && bIsRomaji) return 1;

                    // Within same group, use AMQ's original sort (length → alphabetical)
                    return aStr.length !== bStr.length
                        ? aStr.length - bStr.length
                        : aStr < bStr ? -1 : 1;
                };

                instance.list = dropdownList;
                instance._list = dropdownList;
                instance.evaluate();
            }

            console.log("[Lycee Bot] ✅ Forced list update - Romaji now appears first!");
            return;
        }

        if (retryCount === 0) {
            console.log("[Lycee Bot] Waiting for quiz to start...");

            if (typeof Listener !== 'undefined') {
                new Listener("quiz ready", () => {
                    setTimeout(() => {
                        if (quiz.answerInput?.typingInput?.autoCompleteController) {
                            const controller = quiz.answerInput.typingInput.autoCompleteController;
                            controller.list = dropdownList;
                            controller.newList();

                            if (controller.awesomepleteInstance) {
                                const instance = controller.awesomepleteInstance;
                                instance._romajiSet = new Set(romajiSet);

                                instance.sort = function(a, b) {
                                    const romaji = instance._romajiSet;
                                    const aStr = String(a);
                                    const bStr = String(b);

                                    const aIsRomaji = romaji.has(aStr);
                                    const bIsRomaji = romaji.has(bStr);

                                    // Romaji always comes first
                                    if (aIsRomaji && !bIsRomaji) return -1;
                                    if (!aIsRomaji && bIsRomaji) return 1;

                                    // Within same group, use AMQ's original sort (length → alphabetical)
                                    return aStr.length !== bStr.length
                                        ? aStr.length - bStr.length
                                        : aStr < bStr ? -1 : 1;
                                };

                                instance.list = dropdownList;
                                instance._list = dropdownList;
                                instance.evaluate();
                            }

                            console.log("[Lycee Bot] ✅ List updated on quiz ready - Romaji now appears first!");
                        }
                    }, 100);
                }).bindListener();
            }
        }
    }

    function waitFor(checkFn, maxAttempts = 60, description = 'dependency') {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            console.log(`[Lycee Bot] Waiting for ${description}...`);
            const interval = setInterval(() => {
                if (checkFn()) {
                    clearInterval(interval);
                    console.log(`[Lycee Bot] ✅ ${description} loaded`);
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
            console.log(`[Lycee Bot] updateList called, dropdownList.length = ${dropdownList.length}`);

            if (dropdownList.length === 0) {
                console.warn("[Lycee Bot] List not ready, using default");
                originalUpdateList.call(this);
                return;
            }

            if (this.version === null) {
                const listener = new Listener("get all song names", (payload) => {
                    this.version = payload.version;
                    this.list = dropdownList;
                    this.newList();

                    if (this.awesomepleteInstance) {
                        const instance = this.awesomepleteInstance;
                        instance._romajiSet = new Set(romajiSet);

                        instance.sort = function(a, b) {
                            const romaji = instance._romajiSet;
                            const aStr = String(a);
                            const bStr = String(b);

                            const aIsRomaji = romaji.has(aStr);
                            const bIsRomaji = romaji.has(bStr);

                            // Romaji always comes first
                            if (aIsRomaji && !bIsRomaji) return -1;
                            if (!aIsRomaji && bIsRomaji) return 1;

                            // Within same group, use AMQ's original sort (length → alphabetical)
                            return aStr.length !== bStr.length
                                ? aStr.length - bStr.length
                                : aStr < bStr ? -1 : 1;
                        };

                        instance.list = dropdownList;
                        instance._list = dropdownList;

                        console.log("[Lycee Bot] Sort overridden in updateList (initial)");
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
                            const instance = this.awesomepleteInstance;
                            instance._romajiSet = new Set(romajiSet);

                            instance.sort = function(a, b) {
                                const romaji = instance._romajiSet;
                                const aStr = String(a);
                                const bStr = String(b);

                                const aIsRomaji = romaji.has(aStr);
                                const bIsRomaji = romaji.has(bStr);

                                // Romaji always comes first
                                if (aIsRomaji && !bIsRomaji) return -1;
                                if (!aIsRomaji && bIsRomaji) return 1;

                                // Within same group, use AMQ's original sort (length → alphabetical)
                                return aStr.length !== bStr.length
                                    ? aStr.length - bStr.length
                                    : aStr < bStr ? -1 : 1;
                            };

                            instance.list = dropdownList;
                            instance._list = dropdownList;

                            console.log("[Lycee Bot] Sort overridden in updateList (update)");
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

        console.log("[Lycee Bot] AutoComplete hooked successfully");
    }

    async function initialize() {
        if (isInitialized) return;

        try {
            console.log('[Lycee Bot] Starting initialization...');

            await waitFor(() => typeof libraryCacheHandler !== 'undefined', 60, 'libraryCacheHandler');
            await waitFor(() => typeof AutoCompleteController !== 'undefined', 60, 'AutoCompleteController');
            await waitFor(() => typeof Listener !== 'undefined', 60, 'Listener');
            await waitFor(() => typeof socket !== 'undefined', 60, 'socket');

            hookAutoComplete();

            libraryCacheHandler.getCache((animeCache) => {
                if (!animeCache || Object.keys(animeCache).length === 0) {
                    console.warn("[Lycee Bot] Cache empty, retrying...");
                    setTimeout(() => libraryCacheHandler.getCache(extractNamesFromCache), 2000);
                    return;
                }
                extractNamesFromCache(animeCache);
                isInitialized = true;
            });

            console.log('[Lycee Bot] Script initialized successfully (Romaji First)');
        } catch (error) {
            console.error('[Lycee Bot] Initialization failed:', error);
            console.log('[Lycee Bot] Will retry in 5 seconds...');
            setTimeout(initialize, 5000);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();

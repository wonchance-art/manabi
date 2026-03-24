const urlParams = new URLSearchParams(window.location.search);
        const materialId = urlParams.get('id');

        let currentMaterialData = null; // 원본 데이터를 저장할 전역 변수
        let settings = JSON.parse(localStorage.getItem('reader-settings')) || { size: 1.6, gapV: 15, gapH: 12, theme: 'light', font: "'Noto Sans KR'" };

        function applySettings() {
            const root = document.documentElement;
            root.style.setProperty('--reader-size', settings.size + 'rem');
            root.style.setProperty('--reader-gap-v', settings.gapV + 'px');
            root.style.setProperty('--reader-gap-h', settings.gapH + 'px');
            root.style.setProperty('--reader-font', settings.font + ', sans-serif');
            let bg = 'rgba(255, 255, 255, 0.8)', text = '#2D3436';
            if (settings.theme === 'sepia') { bg = '#f4ecd8'; text = '#5b4636'; }
            else if (settings.theme === 'dark') { bg = '#2D3436'; text = '#f9f9f9'; }
            root.style.setProperty('--reader-bg', bg);
            root.style.setProperty('--reader-text', text);
            localStorage.setItem('reader-settings', JSON.stringify(settings));
        }

        function adjust(type, delta) {
            if (type === 'size') settings.size = Math.max(1, Math.min(3, settings.size + delta));
            if (type === 'gap-v') settings.gapV = Math.max(0, Math.min(50, settings.gapV + delta));
            if (type === 'gap-h') settings.gapH = Math.max(0, Math.min(40, settings.gapH + delta));
            applySettings();
        }

        function setTheme(t) { settings.theme = t; applySettings(); }
        function updateFont(f) { settings.font = f; applySettings(); }

        let scrollDebounceTimer = null;
        window.addEventListener('scroll', () => {
            if (!materialId) return;
            clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(() => {
                localStorage.setItem(`scroll_${materialId}`, window.scrollY);
            }, 300);
        });

        async function loadViewer() {
            applySettings();
            if (!materialId) return;
            try {
                const { data, error } = await sb.from('reading_materials').select('*').eq('id', materialId).single();
                if (error) throw error;

                currentMaterialData = data; // 데이터 보관
                document.getElementById('title').innerText = data.title;

                let json = data.processed_json;
                if (typeof json === 'string') json = JSON.parse(json);
                render(json);

                // 스크롤 복원 및 읽은 위치 안내선 표시
                const savedScroll = localStorage.getItem(`scroll_${materialId}`);
                if (savedScroll) {
                    setTimeout(() => {
                        window.scrollTo({
                            top: parseInt(savedScroll, 10),
                            behavior: 'smooth'
                        });

                        const targetScroll = parseInt(savedScroll, 10);
                        const midPoint = targetScroll + (window.innerHeight / 2);

                        // 글자(토큰) 영역들 중 화면 중앙(midPoint)을 처음 넘어가는 토큰을 탐색
                        const tokens = Array.from(document.querySelectorAll('.word-token:not(.is-break)'));
                        let lineTop = midPoint;

                        for (let t of tokens) {
                            const absoluteTop = t.getBoundingClientRect().top + window.scrollY;
                            if (absoluteTop > midPoint) {
                                // 단어 높이 위쪽 여백(margin) 공간에 선이 위치하도록 조정 (-12px)
                                lineTop = absoluteTop - 12;
                                break;
                            }
                        }

                        // "여기까지 읽었습니다" 심플한 안내선 렌더링 (아이콘, 텍스트 없음)
                        const scrollLine = document.createElement('div');
                        scrollLine.style.position = 'absolute';
                        scrollLine.style.top = `${lineTop}px`;
                        scrollLine.style.left = '0';
                        scrollLine.style.width = '100%';
                        scrollLine.style.height = '1.5px';
                        scrollLine.style.backgroundColor = '#636e72';
                        scrollLine.style.zIndex = '999';
                        scrollLine.style.pointerEvents = 'none';
                        scrollLine.style.transition = 'opacity 1.5s ease-in-out';
                        scrollLine.style.boxShadow = '0 0 8px rgba(99, 110, 114, 0.5)';

                        document.body.appendChild(scrollLine);

                        // 마우스나 터치, 스크롤시 스르륵 사라지는 로직
                        const removeLine = () => {
                            if (scrollLine.style.opacity === '0') return;
                            scrollLine.style.opacity = '0';
                            setTimeout(() => { if (scrollLine.parentNode) scrollLine.remove(); }, 1500);

                            window.removeEventListener('scroll', removeLine);
                            window.removeEventListener('mousemove', removeLine);
                            window.removeEventListener('touchstart', removeLine);
                        };

                        // 3초 뒤 이벤트 리스너 부착 (스크롤이 자동으로 내려가는 애니메이션 도중 꺼지는 현상 방지)
                        setTimeout(() => {
                            window.addEventListener('scroll', removeLine, { once: true });
                            window.addEventListener('mousemove', removeLine, { once: true });
                            window.addEventListener('touchstart', removeLine, { once: true });
                        }, 2500);

                    }, 100);
                }

            } catch (err) { document.getElementById('display').innerHTML = DOMPurify.sanitize(`<div class="error-card">❌ 로드 실패: ${err.message}</div>`); }
        }

        function render(json) {
            const display = document.getElementById('display');
            display.innerHTML = "";

            if (!json || !json.sequence) {
                const raw = currentMaterialData.raw_text;
                display.innerHTML = DOMPurify.sanitize(`<div style="white-space: pre-wrap; line-height: 2; color: #555;">
                <p>⏳ AI가 지문을 해부하고 있습니다. 잠시만 기다려주세요...</p>
                ${raw}
            </div>`);
                setTimeout(loadViewer, 5000);
                return;
            }

            // AI 분석 상태 모니터링 배너
            let banner = document.getElementById('aiBanner');
            const header = document.querySelector('.header');

            if (json.status === 'analyzing' || json.status === 'failed') {
                if (!banner) {
                    banner = document.createElement('div');
                    banner.id = 'aiBanner';
                    banner.style.padding = '12px 20px';
                    banner.style.marginTop = '15px';
                    banner.style.borderRadius = '12px';
                    banner.style.fontWeight = 'bold';
                    banner.style.display = 'flex';
                    banner.style.justifyContent = 'space-between';
                    banner.style.alignItems = 'center';
                    banner.style.fontSize = '0.9rem';
                    header.appendChild(banner);
                }

                const totalText = currentMaterialData.raw_text.trim();
                const totalLines = totalText ? totalText.split('\n').length : 1;
                const currentLine = (json.last_idx !== undefined ? json.last_idx + 1 : 0);

                if (json.status === 'analyzing') {
                    banner.style.backgroundColor = '#fff3cd';
                    banner.style.color = '#856404';
                    banner.style.border = '1px solid #ffeeba';
                    banner.innerHTML = DOMPurify.sanitize(`<span>⏳ AI가 문단별로 분석을 진행하고 있습니다... (진행도: ${currentLine} / ${totalLines})</span>`);

                    // 폴링을 통해 백그라운드 업데이트 감지
                    setTimeout(loadViewer, 5000);
                } else if (json.status === 'failed') {
                    banner.style.backgroundColor = '#f8d7da';
                    banner.style.color = '#721c24';
                    banner.style.border = '1px solid #f5c6cb';
                    banner.innerHTML = DOMPurify.sanitize(`<span>⚠️ AI 분석이 일시적으로 중단되었습니다. (진행도: ${currentLine} / ${totalLines})</span>
                                        <button onclick="window.resumeAnalysis()" style="padding:8px 16px; border-radius:8px; border:none; background:#721c24; color:white; font-weight:bold; cursor:pointer;" id="resumeBtn">이어하기</button>`);
                }
            } else if (banner) {
                banner.remove();
            }

            let quoteOpen = false;
            const puncLeft = [".", ",", "!", "?", ")", "]", "}", "」", "』", ":", ";"];
            const puncRight = ["(", "[", "{", "「", "『"];

            if (json.sequence && json.dictionary) {
                let failedParagraphs = new Set();

                json.sequence.forEach(id => {
                    const info = json.dictionary[id];
                    if (!info) {
                        // dictionary 정보가 누락된 경우 (오류)
                        const token = document.createElement('div');
                        token.className = 'word-token';
                        token.style.backgroundColor = '#ffeeba';
                        token.style.border = '1px solid #ffdf7e';
                        token.style.color = '#856404';
                        token.style.cursor = 'pointer';

                        // Error handling format matching newIds `id_{paragraphIndex}_{wordIndex}_{timestamp}`
                        const match = id.match(/^id_(\d+)_/);
                        const pIndex = match ? match[1] : 'null';

                        if (pIndex !== 'null') {
                            failedParagraphs.add(pIndex);
                        }

                        token.innerHTML = DOMPurify.sanitize(`<span class="surface">⚠️ 분석 오류 (ID: ${id})</span>`);
                        display.appendChild(token);
                        return;
                    }

                    const rawText = info.text || info.surface || "";
                    const text = (rawText.includes('\n')) ? '\n' : rawText.trim();
                    if (!text && rawText !== '\n') return;

                    const token = document.createElement('div');
                    let classes = ['word-token'];

                    const isBreak = (text === '\n' || info.pos === '개행' || info.pos === 'break');
                    if (isBreak) {
                        classes.push('is-break');
                    } else {
                        const isPunc = (info.pos === "기호" || info.pos === "Punctuation" || /^[.,!?;:()[\]{}「」『』"']+$/.test(text));
                        if (isPunc) {
                            classes.push('is-punc');
                            if (puncLeft.includes(text)) {
                                token.style.marginLeft = 'calc(var(--reader-gap-h) * -1)';
                            }
                            if (puncRight.includes(text)) {
                                token.style.marginRight = 'calc(var(--reader-gap-h) * -1)';
                            }
                            if (text === '"' || text === "'") {
                                if (!quoteOpen) { token.style.marginRight = 'calc(var(--reader-gap-h) * -1)'; quoteOpen = true; }
                                else { token.style.marginLeft = 'calc(var(--reader-gap-h) * -1)'; quoteOpen = false; }
                            }
                        }
                    }

                    const isPureKana = /^[\u3040-\u309F\u30A0-\u30FF\u30FC]+$/.test(text);
                    const displayFuri = isPureKana ? "" : (info.furigana || "");

                    token.className = classes.join(' ');
                    token.innerHTML = DOMPurify.sanitize(`<span class="furigana">${displayFuri}</span><span class="surface">${text}</span>`);

                    token.onclick = (e) => {
                        if (isBreak) return;
                        e.stopPropagation();
                        document.getElementById('sheetOverlay').classList.add('active');
                        document.getElementById('bottomSheet').classList.add('active');
                        openEditPanel(id, info);
                    };
                    display.appendChild(token);
                });

                if (failedParagraphs.size > 0 && json.status === 'completed') {
                    const errorArray = Array.from(failedParagraphs).sort((a, b) => a - b);
                    const safeJsonStr = JSON.stringify(errorArray).replace(/"/g, '&quot;');

                    const batchBanner = document.createElement('div');
                    batchBanner.style.width = '100%';
                    batchBanner.style.padding = '12px 20px';
                    batchBanner.style.margin = '20px 0';
                    batchBanner.style.background = '#fff3cd';
                    batchBanner.style.border = '1px solid #ffeeba';
                    batchBanner.style.borderRadius = '12px';
                    batchBanner.innerHTML = DOMPurify.sanitize(`<span style="color:#856404; font-weight:bold;">⚠️ 총 ${failedParagraphs.size}개의 문단에서 분석 오류가 발생했습니다.</span>
                                            <button onclick="retryAllErrors('${safeJsonStr}')" style="margin-left:15px; padding:6px 12px; border-radius:6px; border:none; background:#856404; color:white; font-weight:bold; cursor:pointer; float:right;" id="batchRetryBtn">모든 오류 일괄 복구</button>
                                            <div style="clear:both;"></div>`);
                    display.prepend(batchBanner);
                }
            }

            // 분석 대기 중인 나머지 문단 렌더링 (원문에서 가져와 회색으로 표시)
            const rawText = currentMaterialData.raw_text || "";
            const rawLines = rawText.split('\n');
            const lastIdx = (json.last_idx !== undefined) ? json.last_idx : -1;

            if (json.status === 'analyzing' || json.status === 'failed') {
                for (let i = lastIdx + 1; i < rawLines.length; i++) {
                    const line = rawLines[i];
                    if (!line.trim()) {
                        const br = document.createElement('div');
                        br.className = 'word-token is-break';
                        br.innerHTML = `<span class="surface">\n</span>`;
                        display.appendChild(br);
                        continue;
                    }

                    const token = document.createElement('div');
                    token.className = 'word-token';
                    token.style.opacity = '0.5';
                    token.style.cursor = 'wait';
                    token.innerHTML = DOMPurify.sanitize(`<span class="furigana"></span><span class="surface">⏳ ${line}</span>`);
                    display.appendChild(token);

                    if (i < rawLines.length - 1) {
                        const br = document.createElement('div');
                        br.className = 'word-token is-break';
                        br.innerHTML = `<span class="surface">\n</span>`;
                        display.appendChild(br);
                    }
                }
            } else { // Completed or other status, render with grammar/translation buttons
                const rawLines = currentMaterialData.raw_text.split('\n');
                let currentParagraphTokens = [];
                let currentParagraphIndex = 0;

                json.sequence.forEach(id => {
                    const info = json.dictionary[id];
                    if (!info) return;

                    const rawText = info.text || info.surface || "";
                    const text = (rawText.includes('\n')) ? '\n' : rawText.trim();

                    if (text === '\n' || info.pos === '개행' || info.pos === 'break') {
                        if (currentParagraphTokens.length > 0) {
                            const paraDiv = document.createElement('div');
                            paraDiv.className = 'paragraph-container'; // A container for tokens and buttons
                            paraDiv.style.display = 'flex';
                            paraDiv.style.flexWrap = 'wrap';
                            paraDiv.style.gap = 'var(--reader-gap-v) var(--reader-gap-h)';
                            paraDiv.style.marginBottom = '20px'; // Space between paragraphs

                            const paragraphHtml = currentParagraphTokens.map(t => t.outerHTML).join('');
                            paraDiv.innerHTML = DOMPurify.sanitize(paragraphHtml);
                            display.appendChild(paraDiv);
                        }
                        currentParagraphTokens = [];
                        currentParagraphIndex++;
                    } else {
                        const token = document.createElement('div');
                        let classes = ['word-token'];
                        const isPunc = (info.pos === "기호" || info.pos === "Punctuation" || /^[.,!?;:()[\]{}「」『』"']+$/.test(text));
                        if (isPunc) {
                            classes.push('is-punc');
                            if (puncLeft.includes(text)) { token.style.marginLeft = 'calc(var(--reader-gap-h) * -1)'; }
                            if (puncRight.includes(text)) { token.style.marginRight = 'calc(var(--reader-gap-h) * -1)'; }
                            if (text === '"' || text === "'") {
                                if (!quoteOpen) { token.style.marginRight = 'calc(var(--reader-gap-h) * -1)'; quoteOpen = true; }
                                else { token.style.marginLeft = 'calc(var(--reader-gap-h) * -1)'; quoteOpen = false; }
                            }
                        }
                        const isPureKana = /^[\u3040-\u309F\u30A0-\u30FF\u30FC]+$/.test(text);
                        const displayFuri = isPureKana ? "" : (info.furigana || "");

                        token.className = classes.join(' ');
                        token.innerHTML = DOMPurify.sanitize(`<span class="furigana">${displayFuri}</span><span class="surface">${text}</span>`);
                        token.onclick = (e) => {
                            e.stopPropagation();
                            document.getElementById('sheetOverlay').classList.add('active');
                            document.getElementById('bottomSheet').classList.add('active');
                            openEditPanel(id, info);
                        };
                        currentParagraphTokens.push(token);
                    }
                });

                // Render the last paragraph if any tokens remain
                if (currentParagraphTokens.length > 0) {
                    const paraDiv = document.createElement('div');
                    paraDiv.className = 'paragraph-container';
                    paraDiv.style.display = 'flex';
                    paraDiv.style.flexWrap = 'wrap';
                    paraDiv.style.gap = 'var(--reader-gap-v) var(--reader-gap-h)';
                    paraDiv.style.marginBottom = '20px';

                    const sentenceHtml = currentParagraphTokens.map(t => t.outerHTML).join('');
                    paraDiv.innerHTML = DOMPurify.sanitize(sentenceHtml);
                    display.appendChild(paraDiv);
                }
            }
        }

        window.retryAllErrors = async function (errorArrayStr) {
            const pIndices = JSON.parse(errorArrayStr);
            if (!pIndices || pIndices.length === 0) return;

            const btn = document.getElementById('batchRetryBtn');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = 1;
                btn.style.backgroundColor = '#d35400';
                btn.style.color = 'white';
            }

            console.log("일괄 복구 큐 시작:", pIndices);

            let successCount = 0;
            for (let i = 0; i < pIndices.length; i++) {
                const pIndex = pIndices[i];
                if (btn) btn.innerText = `⏳ 복구 중 (${i + 1} / ${pIndices.length})`;
                console.log(`[Batch Retry] ${i + 1}/${pIndices.length} -> Paragraph ${pIndex} 재시도 중...`);

                // await retryParagraph directly so it queues sequentially
                // passing true for `isBatch` flag so it doesn't try to auto-reload viewer
                const success = await retryParagraph(pIndex, null, true);
                if (success) successCount++;

                // Add a small breather gap between Google API calls to prevent 429 Rate Limits
                await new Promise(r => setTimeout(r, 2000));
            }

            console.log("일괄 복구 완료!");
            if (btn) {
                btn.innerText = `✅ 복구 완료! (${successCount}/${pIndices.length})`;
                btn.style.backgroundColor = '#27ae60';
            }

            // Reload viewer after a short delay
            setTimeout(() => {
                loadViewer();
            }, 1000);
        };

        window.retryParagraph = async function (pIndex, rawId, isBatch = false) {
            if (pIndex === null || pIndex === undefined || pIndex === '') {
                if (!isBatch) alert("문단 번호를 찾을 수 없어 재시도할 수 없습니다.");
                return false;
            }
            pIndex = parseInt(pIndex);

            const btn = window.event && window.event.target ? window.event.target : null;
            if (btn && !isBatch && btn.id !== 'batchRetryBtn') {
                btn.innerText = "⏳ 요청 중...";
                btn.disabled = true;
            }

            const text = currentMaterialData.raw_text;
            const lines = text.split('\n');
            if (pIndex < 0 || pIndex >= lines.length) {
                if (!isBatch) alert("해당 문단을 찾을 수 없습니다.");
                return false;
            }
            const line = lines[pIndex].trim();
            if (!line) {
                if (!isBatch) alert("빈 문단입니다.");
                if (btn && !isBatch && btn.id !== 'batchRetryBtn') {
                    btn.innerText = "↻ 재시도";
                    btn.disabled = false;
                }
                return false;
            }

            const timestamp = Date.now();

            try {
                const prompt = buildTokenizationPrompt(line);
                const rawContent = await callGemini(prompt);
                let payload = parseGeminiJSON(rawContent);

                if (!payload.sequence || !payload.dictionary) throw new Error("sequence 또는 dictionary 오류");

                const { data: dbData, error: dbErr } = await sb.from('reading_materials').select('processed_json').eq('id', materialId).single();
                if (dbErr) throw dbErr;

                let liveJson = dbData.processed_json;
                if (typeof liveJson === 'string') liveJson = JSON.parse(liveJson);

                let newIds = [];
                // ONLY use sequence keys that actually exist in the dictionary
                const validSequence = payload.sequence.filter(AIid => !!payload.dictionary[AIid]);

                validSequence.forEach((oldId, idx) => {
                    const newId = `id_${pIndex}_${idx}_${timestamp}`;
                    newIds.push(newId);

                    let tokenData = payload.dictionary[oldId];

                    // Inject Memory Vault for retried paragraphs
                    if (liveJson.memory_vault && tokenData.text && liveJson.memory_vault[tokenData.text]) {
                        tokenData.meaning = liveJson.memory_vault[tokenData.text].meaning;
                    }

                    liveJson.dictionary[newId] = tokenData;
                });

                // 기존 해당 문단의 잘못된 ID들을 sequence에서 제거하고 새로운 ID 삽입
                const indexPrefix = `id_${pIndex}_`;
                const wrongIds = liveJson.sequence.filter(seqId => seqId.startsWith(indexPrefix));

                if (wrongIds.length > 0) {
                    const firstIndex = liveJson.sequence.indexOf(wrongIds[0]);
                    liveJson.sequence.splice(firstIndex, wrongIds.length, ...newIds);
                    wrongIds.forEach(wId => delete liveJson.dictionary[wId]);
                } else {
                    if (rawId) {
                        const targetIdx = liveJson.sequence.indexOf(rawId);
                        if (targetIdx !== -1) {
                            liveJson.sequence.splice(targetIdx, 1, ...newIds);
                            delete liveJson.dictionary[rawId];
                        }
                    } else {
                        liveJson.sequence.push(...newIds);
                    }
                }

                await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);

                if (!isBatch) {
                    loadViewer(); // 다시 화면 구성
                }
                return true;

            } catch (err) {
                console.error("재시도 오류:", err);
                if (!isBatch) {
                    alert("분석 재시도 중 오류가 발생했습니다: " + err.message);
                    if (btn) {
                        btn.innerText = "↻ 재시도";
                        btn.disabled = false;
                    }
                }
                return false;
            }
        };

        function openEditPanel(id, info) {
            const content = document.getElementById('detailContent');
            content.innerHTML = DOMPurify.sanitize(`
            <div class="detail-header">
                <span class="pos-tag">${info.pos || '단어'}</span>
                <h3>${info.text}</h3>
                <span class="reading">${info.furigana ? '/ ' + info.furigana : ''}</span>
            </div>
            
            <input type="text" id="editMeaning" placeholder="올바른 뜻을 입력하세요..." value="${info.meaning || ''}" />

            <div class="action-buttons">
                <button id="updateBtn" onclick="updateMaterialMeaning('${id}')">💾 지문 수정</button>
                <button id="saveBtn" onclick="saveWord('${info.text.replace(/'/g, "\\\\'")}', '${(info.furigana || "").replace(/'/g, "\\\\'")}', 'manual_edit', '${(info.pos || "").replace(/'/g, "\\\\'")}')">⭐ 내 단어장 저장</button>
            </div>
        `);
        }

        async function updateMaterialMeaning(id) {
            const newMeaning = document.getElementById('editMeaning').value;
            const btn = document.getElementById('updateBtn');
            btn.disabled = true; btn.innerHTML = "⏳ 저장 중...";

            try {
                let updatedJson = currentMaterialData.processed_json;
                if (typeof updatedJson === 'string') updatedJson = JSON.parse(updatedJson);

                updatedJson.dictionary[id].meaning = newMeaning;

                const { error } = await sb.from('reading_materials').update({ processed_json: updatedJson }).eq('id', materialId);
                if (error) throw error;

                btn.innerHTML = "✅ 반영 성공!";
                setTimeout(() => { btn.innerHTML = "💾 지문 데이터에 반영"; btn.disabled = false; }, 1500);
            } catch (err) {
                alert("저장 실패: " + err.message);
                btn.disabled = false; btn.innerHTML = "❌ 다시 시도";
            }
        }

        function closePanel() {
            document.getElementById('sheetOverlay').classList.remove('active');
            document.getElementById('bottomSheet').classList.remove('active');
        }

        // --- AI Grammar Assistant & Selection Logic ---
        let currentSelectedText = "";

        // Use mouseup and touchend to detect when the user finishes selecting
        function handleSelectionEnd(e) {
            // Prevent triggering selection logic if the user clicked inside UI panels
            if (e.target.closest('#bottomSheet') || e.target.closest('#grammarModal') || e.target.closest('#textEditorModal')) {
                return;
            }

            const selection = window.getSelection();
            if (selection.toString().trim().length > 0 && selection.rangeCount > 0) {
                currentSelectedText = selection.toString().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

                // Open the bottom sheet specifically for selection
                openSelectionPanel(currentSelectedText);
            }
        }

        document.addEventListener('mouseup', handleSelectionEnd);
        document.addEventListener('touchend', handleSelectionEnd);

        async function openSelectionPanel(selectedText) {
            document.getElementById('sheetOverlay').classList.add('active');
            document.getElementById('bottomSheet').classList.add('active');

            const content = document.getElementById('detailContent');

            // Initial Loading State mimicking the word detail layout
            content.innerHTML = DOMPurify.sanitize(`
            <div class="detail-header">
                <span class="pos-tag">문장 해석</span>
                <h3>${selectedText}</h3>
            </div>
            
            <div id="selectionTranslationArea">
                <div id="editMeaning" style="display: flex; align-items: center; min-height: 48px; color: #666; font-style: italic;">
                    <div class="spinner" style="display:inline-block; width: 16px; height: 16px; border: 2px solid #ccc; border-top: 2px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></div>
                    자연스러운 해석을 가져오는 중...
                </div>
            </div>

            <div class="action-buttons">
                <button onclick="analyzeGrammar('${selectedText.replace(/'/g, "\\\\'")}')" style="background: var(--primary); color: white; border: none; width: 100%;">💡 핵심 문법 해설 보기</button>
            </div>
            `);

            try {
                // Request a quick translation from Gemini
                const prompt = `Translate the following English phrase/sentence naturally into Korean. Provide ONLY the Korean translation with no extra text or quotes: "${selectedText}"`;

                const translation = (await callGemini(prompt, { temperature: 0.1 })).trim();

                document.getElementById('selectionTranslationArea').innerHTML = DOMPurify.sanitize(`
                    <div id="editMeaning" style="height: auto; min-height: 48px; white-space: pre-wrap; line-height: 1.5;">${translation}</div>
                `);
            } catch (e) {
                console.error("Translation error: ", e);
                document.getElementById('selectionTranslationArea').innerHTML = DOMPurify.sanitize(`
                    <div id="editMeaning" style="color: var(--danger); text-align: center;">해석을 불러오는데 실패했습니다.</div>
                `);
            }
        }

        function closeGrammarModal() {
            document.getElementById('grammarModal').style.display = 'none';
        }

        async function analyzeGrammar(targetText) {
            // Normalize excessive whitespace and linebreaks commonly caused by selecting across floating elements
            targetText = targetText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
            if (!targetText) return;

            // Show Modal and Loader
            const modal = document.getElementById('grammarModal');
            const body = document.getElementById('grammarBody');

            document.getElementById('gTargetText').innerText = targetText;
            body.innerHTML = DOMPurify.sanitize(`
                <div class="g-loader">
                    <div class="spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 15px; font-weight:bold;">Gemini AI가 문법 구조를 해체중입니다...</p>
                </div>
            `);
            modal.style.display = 'flex';

            try {
                const prompt = `
You are an expert English Grammar and Syntax tutor for Korean speakers.
Analyze the following sentence snippet and provide a precise, easy-to-understand explanation of its key grammatical points.

Target Snippet: "${targetText}"

Instruction:
1. Explain the key grammar points. For the specific grammar term or core concept, wrap it in HTML <b> tags (e.g., "<b>분사구문</b>이 쓰여서...").
2. The explanation should be in plain, normal font weight, except for the highlighted grammar term itself.

Provide the response in the following strict JSON format (DO NOT include Markdown wrappers or any other text):
{
  "points": [
    "HTML <b> highlighting for the grammar term followed by a plain text explanation.",
    "Another point..."
  ]
}`;

                const rawContent = await callGemini(prompt, { temperature: 0.1, response_mime_type: "application/json" });
                let payload;
                try {
                    payload = parseGeminiJSON(rawContent);
                } catch (e) { throw new Error("분석 결과를 파싱하지 못했습니다."); }

                let pointsHtml = payload.points.map(p => `<li>${p}</li>`).join('');

                body.innerHTML = DOMPurify.sanitize(`
                    <div class="g-section">
                        <div class="g-section-title">💡 핵심 문법 포인트</div>
                        <ul class="g-list" style="background:rgba(255,255,255,0.5); padding:15px 15px 15px 35px; border-radius:12px; border:1px solid #edf2f7;">${pointsHtml}</ul>
                    </div>
                `);

            } catch (e) {
                console.error(e);
                body.innerHTML = DOMPurify.sanitize(`<div style="text-align: center; color: var(--danger); padding: 30px; font-weight:bold;">문법 분석 중 오류가 발생했습니다.<br><br>${e.message}</div>`);
            }
        }

        function openTextEditor() {
            if (!currentMaterialData) return;
            document.getElementById('editorOverlay').classList.add('active');
            document.getElementById('textEditorModal').classList.add('active');
            document.getElementById('editorTextarea').value = currentMaterialData.raw_text || '';
        }

        function closeTextEditor() {
            document.getElementById('editorOverlay').classList.remove('active');
            document.getElementById('textEditorModal').classList.remove('active');
        }

        async function saveEditedText() {
            const btn = document.getElementById('saveEditorBtn');
            const newText = document.getElementById('editorTextarea').value.trim();
            if (!newText) return alert("텍스트를 입력해주세요.");

            btn.disabled = true;
            btn.innerHTML = "⏳ 처리 중...";

            try {
                let liveJson = currentMaterialData.processed_json;
                if (typeof liveJson === 'string') liveJson = JSON.parse(liveJson);

                // 1. Memory Vault 추출
                if (!liveJson.memory_vault) liveJson.memory_vault = {};
                for (const key in liveJson.dictionary) {
                    const info = liveJson.dictionary[key];
                    if (info.meaning && info.text) {
                        liveJson.memory_vault[info.text] = { meaning: info.meaning };
                    }
                }

                // 2. Smart Diff (문단 단위 로직)
                const oldLines = (currentMaterialData.raw_text || "").split('\n');
                const newLines = newText.split('\n');

                let newSequence = [];
                let newDictionary = {};

                for (let i = 0; i < newLines.length; i++) {
                    const newLine = newLines[i].trim();
                    let matchFound = false;

                    for (let j = 0; j < oldLines.length; j++) {
                        if (oldLines[j] !== null && oldLines[j].trim() === newLine && newLine !== "") {
                            // 기존 문단 재사용
                            const prefix = `id_${j}_`;
                            const oldIds = liveJson.sequence.filter(id => id.startsWith(prefix));

                            if (oldIds.length > 0) {
                                oldIds.forEach(oldId => {
                                    const parts = oldId.split('_');
                                    const newId = `id_${i}_${parts[2]}_${parts[3]}`; // update index
                                    newSequence.push(newId);
                                    newDictionary[newId] = liveJson.dictionary[oldId];
                                });

                                if (i < newLines.length - 1) {
                                    const brId = `br_${i}_${Date.now()}`;
                                    newSequence.push(brId);
                                    newDictionary[brId] = { text: "\n", pos: "개행" };
                                }

                                oldLines[j] = null; // Prevent duplicate matching
                                matchFound = true;
                                break;
                            }
                        }
                    }

                    if (!matchFound) {
                        if (newLine === "") {
                            if (i < newLines.length - 1) {
                                const newBrId = `br_${i}_0_${Date.now()}`;
                                newSequence.push(newBrId);
                                newDictionary[newBrId] = { text: "\n", pos: "개행" };
                            }
                        } else {
                            // 단어 단위 보존이 띄어쓰기 토큰화에서 뭉개지는 현상을 방지하기 위해 문단 전체 재분석 방식으로 롤백.
                            // 사용자가 직접 입력했던 뜻은 Memory Vault 기술을 통해 백그라운드에서 자동 복구됨!
                            const pId = `p_${i}`;
                            newSequence.push(pId);
                            newDictionary[pId] = { is_placeholder: true, text: newLine };

                            if (i < newLines.length - 1) {
                                const newBrId = `br_${i}_1_${Date.now()}`;
                                newSequence.push(newBrId);
                                newDictionary[newBrId] = { text: "\n", pos: "개행" };
                            }
                        }
                    }
                }

                liveJson.sequence = newSequence;
                liveJson.dictionary = newDictionary;

                // 분석 대기 중인 항목 찾기 (p_ + newLines 인덱스)
                const pendingIds = newSequence.filter(id => id.startsWith('p_'));
                const needsAnalysis = pendingIds.length > 0;

                // 마지막 분석 완료 인덱스 계산 (재개 기능 버그 수정: 가장 처음 등장하는 p_ 의 인덱스를 last_idx로 설정하여 그 지점부터 분석하게 함)
                if (needsAnalysis) {
                    liveJson.status = "analyzing";
                    // 찾은 첫 p_x 의 x값을 last_idx 전 단계로 설정
                    const firstP = pendingIds[0];
                    const firstPIdx = parseInt(firstP.split('_')[1], 10);
                    liveJson.last_idx = Math.max(-1, firstPIdx - 1);
                } else {
                    liveJson.status = "completed";
                    liveJson.last_idx = newLines.length - 1;
                }

                const { error } = await sb.from('reading_materials').update({
                    raw_text: newText,
                    processed_json: liveJson
                }).eq('id', materialId);

                if (error) throw error;

                currentMaterialData.raw_text = newText;
                currentMaterialData.processed_json = liveJson;

                closeTextEditor();
                loadViewer();

                if (needsAnalysis) {
                    setTimeout(() => {
                        window.resumeAnalysis();
                    }, 500);
                }

            } catch (err) {
                console.error("저장 오류:", err);
                alert("수정 실패: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = "💾 변경사항 저장";
            }
        }


        let recentVocabs = [];

        function updateVocabWidget() {
            const countSpan = document.getElementById('vocabCount');
            const widget = document.getElementById('vocabWidget');
            const listDiv = document.getElementById('vocabList');

            countSpan.innerText = recentVocabs.length;

            // Pop Animation
            widget.classList.remove('pulse');
            void widget.offsetWidth; // trigger reflow
            widget.classList.add('pulse');

            if (recentVocabs.length === 0) {
                listDiv.innerHTML = `<div style="color:#999; text-align:center; padding:20px; font-size:0.9rem;">아직 수집된 단어가 없습니다.</div>`;
                return;
            }

            // Render List (Latest first)
            listDiv.innerHTML = DOMPurify.sanitize(recentVocabs.slice().reverse().map(v => `
                <div class="vocab-item-mini">
                    <div style="font-weight:bold; font-size:1.2rem; color:#2D3436;">${v.text} <span style="font-size:0.8rem; color:#8E97FD; font-weight:normal;">${v.furigana ? '/ ' + v.furigana : ''}</span></div>
                    <div style="font-size:0.85rem; color:#666; margin-top:2px;">${v.meaning || '(뜻 없음)'}</div>
                </div>
            `).join(''));
        }

        function toggleVocabPopup() {
            document.getElementById('vocabPopup').classList.toggle('active');
        }

        async function saveWord(text, furigana, source, pos) {
            const meaning = source === 'manual_edit' ? document.getElementById('editMeaning').value : "";
            const btn = document.getElementById('saveBtn');
            btn.disabled = true; btn.innerHTML = "⏳ 저장 중...";
            try {
                await sb.from('my_vocabulary').insert([{ text, furigana, meaning, pos, material_id: materialId }]);
                recentVocabs.push({ text, furigana, meaning });
                updateVocabWidget();

                btn.innerHTML = "✅ 저장 완료!"; btn.style.background = "var(--success)";
                setTimeout(() => { btn.innerHTML = "⭐ 단어장에 저장"; btn.style.background = "var(--primary)"; btn.disabled = false; }, 1500);
            } catch (err) { btn.disabled = false; btn.innerHTML = "❌ 다시 시도"; }
        }

        document.addEventListener('click', (e) => {
            const vocabPopup = document.getElementById('vocabPopup');
            const vocabWidget = document.getElementById('vocabWidget');
            if (vocabPopup.classList.contains('active') && !vocabPopup.contains(e.target) && !vocabWidget.contains(e.target)) {
                vocabPopup.classList.remove('active');
            }
        });

        // --- 뷰어 내장 이어하기 기능 ---
        window.resumeAnalysis = async function () {
            const btn = document.getElementById('resumeBtn');
            if (btn) { btn.disabled = true; btn.innerText = "진행 중..."; }

            const text = currentMaterialData.raw_text;

            const resumeLines = text.split('\\n');
            const resumeTimestamp = Date.now();
            let failCount = 0;

            // 이미 분석중이 아니면 analyzing 상태로 변경
            let currentJson = currentMaterialData.processed_json;
            if (typeof currentJson === 'string') currentJson = JSON.parse(currentJson);

            currentJson.status = "analyzing";
            await sb.from('reading_materials').update({ processed_json: currentJson }).eq('id', materialId);
            loadViewer(); // UI 갱신 (analyzing 상태 배너 띄우기)

            for (let i = 0; i < resumeLines.length; i++) {
                const line = resumeLines[i].trim();

                const { data: dbData } = await sb.from('reading_materials').select('processed_json').eq('id', materialId).single();
                let liveJson = dbData.processed_json;

                if (liveJson.status === "completed") break;
                if (liveJson.status === "failed") break;

                // Smart Diff skip logic: Check if this line is already analyzed
                const hasTokens = liveJson.sequence.some(id => id.startsWith(`id_${i}_`));
                const hasPlaceholder = liveJson.sequence.includes(`p_${i}`);
                if (hasTokens && !hasPlaceholder) {
                    failCount = 0;
                    liveJson.last_idx = Math.max(liveJson.last_idx, i);
                    if (i === resumeLines.length - 1) liveJson.status = "completed";

                    await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);
                    continue;
                }

                if (!line) {
                    // Placeholder check (can be p_i or p_i_chunk)
                    const targetIds = liveJson.sequence.filter(id => id.startsWith(`p_${i}`));
                    if (targetIds.length > 0) {
                        targetIds.forEach(tId => {
                            const index = liveJson.sequence.indexOf(tId);
                            if (index !== -1) liveJson.sequence.splice(index, 1);
                            delete liveJson.dictionary[tId];
                        });
                    }
                    if (i < resumeLines.length - 1) {
                        const brId = `br_${i}_${resumeTimestamp}`;
                        liveJson.sequence.push(brId);
                        liveJson.dictionary[brId] = { text: "\\n", pos: "개행" };
                    }
                    liveJson.last_idx = i;
                    if (i === resumeLines.length - 1) liveJson.status = "completed";
                    await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);
                    continue;
                }

                // Paragraph-level full analysis for modified paragraphs
                const placeholderIds = liveJson.sequence.filter(id => id.startsWith(`p_${i}`));
                if (placeholderIds.length === 0) {
                    liveJson.last_idx = Math.max(liveJson.last_idx, i);
                    if (i === resumeLines.length - 1) {
                        liveJson.status = "completed";
                        await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);
                    }
                    continue; // No analysis needed for this line
                }

                // placeholderIds[0] contains the text of the entire paragraph to re-analyze
                const targetPId = placeholderIds[0];
                const prompt = buildTokenizationPrompt(liveJson.dictionary[targetPId].text);

                // Proactive Validation Loop: Try up to 3 times to get a pristine JSON for this paragraph
                let parseSuccess = false;
                let retryAttempts = 0;
                let payload = null;

                while (!parseSuccess && retryAttempts < 3) {
                    retryAttempts++;
                    try {
                        const rawContent = await callGemini(prompt);
                        payload = parseGeminiJSON(rawContent);

                        if (!payload.sequence || !payload.dictionary) {
                            throw new Error("sequence 또는 dictionary가 누락되었습니다.");
                        }

                        // Strict Validation: Ensure every sequence ID has a valid dictionary entry
                        const validSequenceCount = payload.sequence.filter(AIid => !!payload.dictionary[AIid]).length;
                        if (validSequenceCount !== payload.sequence.length) {
                            throw new Error(`sequence 길이(${payload.sequence.length})와 유효 dictionary 수(${validSequenceCount}) 불일치`);
                        }

                        parseSuccess = true;
                    } catch (attemptError) {
                        console.warn(`[문단 ${i + 1}] ${retryAttempts}차 파싱 실패, 재시도 중...`, attemptError.message);
                        if (retryAttempts >= 3) {
                            throw new Error(`3회 재시도 모두 실패: ${attemptError.message}`);
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                try {
                    // We successfully parsed and validated the whole line!
                    const targetIdx = liveJson.sequence.indexOf(targetPId);
                    if (targetIdx !== -1) {
                        let matchedAITokens = [];

                        // ONLY use sequence keys that actually exist in the dictionary
                        const validSequence = payload.sequence.filter(AIid => !!payload.dictionary[AIid]);

                        validSequence.forEach((AIid, tokenIndex) => {
                            const AIToken = payload.dictionary[AIid];
                            const newId = `id_${i}_${tokenIndex}_${resumeTimestamp}`;

                            // Inject Memory Vault back into tokens!
                            if (liveJson.memory_vault && AIToken.text && liveJson.memory_vault[AIToken.text]) {
                                AIToken.meaning = liveJson.memory_vault[AIToken.text].meaning;
                                if (liveJson.memory_vault[AIToken.text].furigana) {
                                    AIToken.furigana = liveJson.memory_vault[AIToken.text].furigana;
                                }
                            }

                            liveJson.dictionary[newId] = AIToken;
                            matchedAITokens.push(newId);
                        });

                        // Replace the entire placeholder with the full sequence of accurate tokens
                        liveJson.sequence.splice(targetIdx, 1, ...matchedAITokens);
                        delete liveJson.dictionary[targetPId];
                    }

                    liveJson.last_idx = i;
                    if (i === resumeLines.length - 1) liveJson.status = "completed";

                    await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);
                    failCount = 0;

                } catch (err) {
                    console.error(`${i + 1}번 문단 뷰어 내장 분석 중단:`, err);
                    failCount++;
                    if (failCount >= 3) {
                        liveJson.status = "failed";
                        await sb.from('reading_materials').update({ processed_json: liveJson }).eq('id', materialId);
                        loadViewer();
                        break;
                    }
                    i--;
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            loadViewer();
        }

        loadViewer();
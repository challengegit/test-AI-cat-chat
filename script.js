document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const catListSp = document.getElementById('cat-list-sp');
    const catListPc = document.getElementById('cat-list-pc');
    const chatLog = document.getElementById('chat-log');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    // --- グローバル変数 ---
    let catsData = [];
    let selectedCat = null;
    const catFiles = ['teto.txt', 'pino.txt']; // 将来的に猫を増やす場合はここに追加

    // --- 初期化処理 ---
    async function initialize() {
        await loadAllCatData();
        displayCatLists();
        addCatSelectionListeners();
    }

    // --- 猫データの読み込みと解析 ---
    async function loadAllCatData() {
        try {
            const promises = catFiles.map(file => 
                fetch(`data/${file}`)
                    .then(response => {
                        if (!response.ok) throw new Error(`ファイルが見つかりません: ${file}`);
                        return response.text();
                    })
                    .then(text => parseCatData(text))
            );
            catsData = await Promise.all(promises);
        } catch (error) {
            console.error('猫データの読み込みに失敗しました:', error);
            alert('猫データの読み込みに失敗しました。ファイルパスやファイル名を確認してください。');
        }
    }

    function parseCatData(text) {
        const cat = {};
        const parts = text.split('---');
        const profilePart = parts[0];
        
        profilePart.split('\n').forEach(line => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim();
                cat[key.trim()] = value;
            }
        });
        
        // AI用のプロンプトも保持しておく（Step 4以降で使用）
        cat.aiProfile = parts[1] || '';
        cat.aiTriggers = parts[2] || '';
        
        return cat;
    }

    // --- 猫リストの表示 ---
    function displayCatLists() {
        catListSp.innerHTML = '';
        catListPc.innerHTML = '';

        catsData.forEach(cat => {
            if (!cat.id || !cat.name) return; // 不完全なデータはスキップ
            // スマホ用アイコン
            const iconHtml = `
                <div class="cat-icon-sp" data-id="${cat.id}">
                    <img src="${cat.profileImage}" alt="${cat.name}">
                    <span>${cat.name}</span>
                </div>`;
            catListSp.innerHTML += iconHtml;

            // PC用リスト
            const itemHtml = `
                <div class="cat-item" data-id="${cat.id}">
                    <img src="${cat.profileImage}" alt="${cat.name}">
                    <div class="info">
                        <div class="name">${cat.name}</div>
                        <div class="details">${cat.gender}, ${cat.age}</div>
                        <div class="details">${cat.birthplace}</div>
                    </div>
                </div>`;
            catListPc.innerHTML += itemHtml;
        });
    }

    // --- 猫選択のイベントリスナー ---
    function addCatSelectionListeners() {
        document.querySelectorAll('.cat-icon-sp, .cat-item').forEach(item => {
            item.addEventListener('click', () => {
                const catId = item.dataset.id;
                selectCat(catId);
            });
        });
    }

    function selectCat(catId) {
        selectedCat = catsData.find(cat => cat.id === catId);
        
        // UIの選択状態を更新
        document.querySelectorAll('.cat-icon-sp, .cat-item').forEach(item => {
            item.classList.remove('selected');
            if (item.dataset.id === catId) {
                item.classList.add('selected');
            }
        });

        // チャットを有効化
        enableChat();
        chatLog.innerHTML = `<div class="message system-message">${selectedCat.name}とのチャットを開始しました。</div>`;
    }

    // --- チャットの有効/無効化 ---
    function enableChat() {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.placeholder = `${selectedCat.name}へのメッセージを入力`;
        messageInput.focus();
    }

    // --- チャットフォームの送信処理 ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userMessage = messageInput.value.trim();
        if (userMessage && selectedCat && !sendButton.disabled) {
            displayMessage(userMessage, 'user');
            messageInput.value = '';
            getDummyAiReply(userMessage);
        }
    });

    // --- メッセージの表示 ---
    function displayMessage(text, sender, imageUrl = null) {
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message', `${sender}-message`);

        let messageHtml = '';
        if (sender === 'ai') {
            messageHtml += `<img src="${selectedCat.profileImage}" alt="${selectedCat.name}" class="avatar">`;
        }

        messageHtml += `<div class="message-content">`;
        if (text) {
            messageHtml += `<div class="message-text">${text}</div>`;
        }
        if (imageUrl) {
            messageHtml += `<img src="${imageUrl}" alt="チャット画像">`;
        }
        messageHtml += `</div>`;
        
        messageWrapper.innerHTML = messageHtml;
        chatLog.appendChild(messageWrapper);
        chatLog.scrollTop = chatLog.scrollHeight; // 自動で一番下にスクロール
    }

    // --- 【ダミーAI応答】ここがStep4で本物のAIに置き換わる部分 ---
    function getDummyAiReply(userMessage) {
        sendButton.disabled = true;
        
        // ダミーのタイピング中表示
        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'ai-message', 'typing');
        typingIndicator.innerHTML = `<img src="${selectedCat.profileImage}" alt="avatar" class="avatar"><div class="message-content">...</div>`;
        chatLog.appendChild(typingIndicator);
        chatLog.scrollTop = chatLog.scrollHeight;
        
        setTimeout(() => {
            chatLog.removeChild(typingIndicator); // タイピング中表示を削除
            
            // "箱"という単語が含まれていたら、特別な返信をするテスト
            if (userMessage.includes('箱') && selectedCat.id === 'teto') {
                 displayMessage('この箱にはいることにゃー', 'ai', 'images/teto_box.jpg');
            } else {
                const replyText = `${userMessage}にゃー`;
                displayMessage(replyText, 'ai');
            }
            sendButton.disabled = false;
            messageInput.focus();
        }, 1000); // 1秒後に返信
    }

    // --- 実行 ---
    initialize();
});

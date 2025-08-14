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
    let conversationHistory = []; // 会話履歴を保持する配列
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
            const trimmedLine = line.trim();
            if (trimmedLine.includes(':')) {
                const [key, ...valueParts] = trimmedLine.split(':');
                const value = valueParts.join(':').trim();
                cat[key.trim()] = value;
            }
        });

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

        // チャットを有効化し、会話履歴をリセット
        conversationHistory = [];
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
            // 【重要】本物のAI応答関数を呼び出す
            getAiReply(userMessage);
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

    // --- 【本物のAI応答】サーバーと通信する関数 ---
    async function getAiReply(userMessage) {
        sendButton.disabled = true;

        const typingIndicator = document.createElement('div');
        typingIndicator.classList.add('message', 'ai-message', 'typing');
        typingIndicator.innerHTML = `<img src="${selectedCat.profileImage}" alt="avatar" class="avatar"><div class="message-content">...</div>`;
        chatLog.appendChild(typingIndicator);
        chatLog.scrollTop = chatLog.scrollHeight;

        // ▼▼▼▼▼ ここが修正された部分です ▼▼▼▼▼
        // サーバーのURLを動的に生成する
        const backendPort = 10000; // バックエンドサーバーのポート番号
        const currentHost = window.location.hostname; // 現在のページのホスト名を取得
        // ローカル環境(localhost)とCodespaces環境の両方に対応
        const serverUrl = currentHost.includes('localhost')
            ? `http://localhost:${backendPort}/chat`
            : `https://${currentHost.replace(/-\d+/, `-${backendPort}`)}/chat`;
        // ▲▲▲▲▲ 修正箇所ここまで ▲▲▲▲▲

        try {
            const requestData = {
                catId: selectedCat.id,
                question: userMessage,
                history: conversationHistory
            };

            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
            });

            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);

            const data = await response.json();
            let aiReply = data.reply;

            // 会話履歴を更新
            conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });
            conversationHistory.push({ role: 'model', parts: [{ text: aiReply }] });

            // [IMAGE:...] タグを正規表現で検索
            const imageRegex = /\[IMAGE:\s*([^\]]+)\]/g;
            const match = imageRegex.exec(aiReply);
            let imageUrl = null;

            if (match) {
                // タグをテキストから削除し、画像パスを取得
                aiReply = aiReply.replace(imageRegex, '').trim();
                imageUrl = match[1].trim();
            }

            displayMessage(aiReply, 'ai', imageUrl);

        } catch (error) {
            console.error('AIからの応答取得中にエラー:', error);
            displayMessage('ごめんにゃ、ちょっと調子が悪いみたいだにゃん…', 'ai');
        } finally {
            chatLog.removeChild(typingIndicator);
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    // --- 実行 ---
    initialize();
});

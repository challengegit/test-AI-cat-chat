// グローバル変数とDOM要素の取得
const chatLog = document.getElementById('chat-log');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const chatForm = document.getElementById('chat-form');
const catListPC = document.getElementById('cat-list-pc');
const catListSP = document.getElementById('cat-list-sp');

let currentCatId = null;
let chatHistory = [];
let isWaitingForResponse = false;
let allCats = []; // 猫の全情報を保持する配列

/**
 * ページの読み込みが完了したときに実行される初期化関数
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // サーバーから猫のリストを取得
        const response = await fetch('/cats');
        if (!response.ok) {
            throw new Error('猫リストの取得に失敗しました。');
        }
        allCats = await response.json(); // 取得した猫情報をグローバル変数に保存
        // 猫リストを画面に表示
        displayCatList(allCats);
    } catch (error) {
        console.error(error);
        addMessage('system', 'エラー: 猫の情報を読み込めませんでした。');
    }

    // フォームの送信イベントを設定
    chatForm.addEventListener('submit', handleFormSubmit);
});

/**
 * サーバーから取得した猫のリストを画面に表示する
 * @param {Array} cats - 猫の情報オブジェクトの配列
 */
function displayCatList(cats) {
    // リストをクリア
    catListPC.innerHTML = '';
    catListSP.innerHTML = '';

    cats.forEach(cat => {
        // PC用リストアイテムの作成
        const catItemPC = document.createElement('div');
        catItemPC.className = 'cat-item';
        catItemPC.dataset.catId = cat.id;
        catItemPC.innerHTML = `
            <img src="${cat.profileImage}" alt="${cat.name}" class="cat-profile-img">
            <div class="cat-info">
                <p class="cat-name">${cat.name}</p>
                <p class="cat-description">${cat.description}</p>
            </div>
        `;
        catItemPC.addEventListener('click', () => selectCat(cat));
        catListPC.appendChild(catItemPC);

        // SP用アイコンの作成
        const catIconSP = document.createElement('img');
        catIconSP.src = cat.profileImage;
        catIconSP.alt = cat.name;
        catIconSP.className = 'cat-icon-sp';
        catIconSP.dataset.catId = cat.id;
        catIconSP.addEventListener('click', () => selectCat(cat));
        catListSP.appendChild(catIconSP);
    });
}

/**
 * 猫が選択されたときの処理
 * @param {object} cat - 選択された猫の情報オブジェクト
 */
function selectCat(cat) {
    currentCatId = cat.id;
    chatHistory = []; // 新しい猫と話すときは履歴をリセット
    isWaitingForResponse = false;

    // チャットログをクリアして挨拶メッセージを表示
    chatLog.innerHTML = '';
    addMessage('system', `${cat.name}とのチャットを開始しました。`);

    // 入力欄と送信ボタンを有効化
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.placeholder = `${cat.name}へのメッセージを入力`;
    messageInput.focus();

    // 選択状態のスタイルを更新
    updateSelectedCatStyle();
}

/**
 * 選択された猫のUIスタイルを更新する
 */
function updateSelectedCatStyle() {
    document.querySelectorAll('.cat-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.catId === currentCatId);
    });
    document.querySelectorAll('.cat-icon-sp').forEach(icon => {
        icon.classList.toggle('selected', icon.dataset.catId === currentCatId);
    });
}

/**
 * メッセージフォーム送信時の処理
 * @param {Event} e - イベントオブジェクト
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const userMessage = messageInput.value.trim();

    if (userMessage && currentCatId && !isWaitingForResponse) {
        messageInput.value = '';
        addMessage('user', userMessage);
        await getAiResponse(userMessage);
    }
}

/**
 * AIからの応答を取得して表示する
 * @param {string} userMessage - ユーザーからのメッセージ
 */
async function getAiResponse(userMessage) {
    toggleLoading(true);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                catId: currentCatId,
                question: userMessage,
                history: chatHistory
            }),
        });

        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }

        const data = await response.json();
        const aiReply = data.reply;

        addMessage('ai', aiReply);

        chatHistory.push({ role: "user", parts: [{ text: userMessage }] });
        chatHistory.push({ role: "model", parts: [{ text: aiReply }] });

    } catch (error) {
        console.error('AI応答の取得中にエラー:', error);
        addMessage('system', 'ごめんなさい、AIとの通信に失敗しました。');
    } finally {
        toggleLoading(false);
    }
}


/**
 * チャットログにメッセージを追加する
 * @param {string} sender - 送信者 ('user', 'ai', 'system')
 * @param {string} text - メッセージテキスト
 */
function addMessage(sender, text) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', `${sender}-message`);

    // 画像トリガー `[IMAGE: path]` をHTMLの `<img>` タグに変換
    const processedText = text.replace(/\[IMAGE: (.*?)\]/g, (match, imagePath) => {
        return `<img src="${imagePath.trim()}" alt="猫からの画像" class="chat-image">`;
    }).replace(/\n/g, '<br>');

    // --- ここからが重要 ---
    if (sender === 'ai') {
        const currentCat = allCats.find(cat => cat.id === currentCatId);
        const profileImage = currentCat ? currentCat.profileImage : '';
        
        messageElement.innerHTML = `
            <img src="${profileImage}" alt="${currentCat.name}" class="ai-avatar">
            <div class="message-bubble">${processedText}</div>
        `;
    } else {
        messageElement.innerHTML = processedText;
    }
    // --- ここまで ---
    
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // 自動で一番下にスクロール
}

/**
 * AI応答中のローディング状態を切り替える
 * @param {boolean} isLoading - ローディング中かどうか
 */
function toggleLoading(isLoading) {
    isWaitingForResponse = isLoading;
    if (isLoading) {
        sendButton.disabled = true;
        sendButton.textContent = '...';
        // ローディングインジケーターをAIメッセージと同じ形式で追加
        const loadingContainer = document.createElement('div');
        loadingContainer.id = 'loading';
        loadingContainer.className = 'message ai-message';
        const currentCat = allCats.find(cat => cat.id === currentCatId);
        const profileImage = currentCat ? currentCat.profileImage : '';
        loadingContainer.innerHTML = `
            <img src="${profileImage}" alt="avatar" class="ai-avatar">
            <div class="message-bubble">
                <div class="typing-indicator"><span></span><span></span><span></span></div>
            </div>
        `;
        chatLog.appendChild(loadingContainer);
        chatLog.scrollTop = chatLog.scrollHeight;
    } else {
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) loadingIndicator.remove();
        sendButton.disabled = false;
        sendButton.textContent = '送信';
        messageInput.focus();
    }
}

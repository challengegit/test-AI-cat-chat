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
        const cats = await response.json();
        // 猫リストを画面に表示
        displayCatList(cats);
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
    // PC用サイドバーのスタイル更新
    document.querySelectorAll('.cat-item').forEach(item => {
        if (item.dataset.catId === currentCatId) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });

    // SP用ヘッダーのスタイル更新
    document.querySelectorAll('.cat-icon-sp').forEach(icon => {
        if (icon.dataset.catId === currentCatId) {
            icon.classList.add('selected');
        } else {
            icon.classList.remove('selected');
        }
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
        
        // AIからの応答を待つ
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

        // 応答をチャットログに追加
        addMessage('ai', aiReply);

        // 会話履歴を更新
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
    });

    // テキスト内の改行を<br>に変換してHTMLに設定
    messageElement.innerHTML = processedText.replace(/\n/g, '<br>');
    
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
        // ローディングインジケーターを追加
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading';
        loadingIndicator.className = 'message ai-message';
        loadingIndicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        chatLog.appendChild(loadingIndicator);
        chatLog.scrollTop = chatLog.scrollHeight;
    } else {
        // ローディングインジケーターを削除
        const loadingIndicator = document.getElementById('loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        sendButton.disabled = false;
        sendButton.textContent = '送信';
        messageInput.focus();
    }
}

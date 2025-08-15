// ----------------------------------------------------------------
// 猫AIチャット バックエンドサーバー (一体型・最終完成版)
// ----------------------------------------------------------------

// 必要なライブラリを読み込む
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Expressアプリを初期化
const app = express();

// このディレクトリにある静的ファイル(CSS, JS, 画像など)を提供する設定
app.use(express.static(__dirname));

// ルートURL('/')にアクセスが来たら、index.htmlを返す設定
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.json()); // JSONリクエストを扱えるようにする

// --- APIキーのセットアップ ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("エラー: 環境変数に GEMINI_API_KEY が設定されていません。");
  process.exit(1);
}

// Google AIクライアントの初期化
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// ▼▼▼▼▼ ここからが重要な追加部分 ▼▼▼▼▼

// --- 猫リスト取得API ---
// dataディレクトリ内の全.txtファイルを読み込み、基本情報をフロントエンドに返す
app.get('/cats', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, 'data');
    const files = await fs.readdir(dataDir);
    const catFiles = files.filter(file => file.endsWith('.txt'));

    let catsData = [];
    for (const file of catFiles) {
      const filePath = path.join(dataDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const profileInfo = {};
      const lines = content.split('---')[0].split('\n');
      lines.forEach(line => {
        const [key, ...value] = line.split(':');
        if (key && value.length > 0) {
          profileInfo[key.trim()] = value.join(':').trim();
        }
      });
      catsData.push({
        id: profileInfo.id,
        name: profileInfo.name,
        profileImage: profileInfo.profileImage,
        description: `${profileInfo.gender}, ${profileInfo.age}, ${profileInfo.birthplace}`
      });
    }

    // 指定された順番に並び替える
    const order = ['pino', 'teto', 'ruka', 'abi', 'bell', 'rate'];
    catsData.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

    res.json(catsData);
  } catch (error) {
    console.error('猫リストの取得中にエラーが発生しました:', error);
    res.status(500).json({ error: '猫の情報の取得に失敗しました。' });
  }
});

// ▲▲▲▲▲ ここまで ▲▲▲▲▲


// --- メインのチャット処理API ---
app.post('/chat', async (req, res) => {
  try {
    const { catId, question, history } = req.body;
    if (!catId || !question) {
      return res.status(400).json({ error: '猫のIDと質問は必須です。' });
    }
    const catProfilePath = path.join(__dirname, 'data', `${catId}.txt`);
    const profileText = await fs.readFile(catProfilePath, 'utf-8');
    const parts = profileText.split('---');
    const systemPrompt = parts[1]?.trim() || '';
    const imageTriggerPrompt = parts[2]?.trim() || '';
    const fullPrompt = `${systemPrompt}\n\nあなたは以上の設定に完璧になりきってください。\nさらに、以下のルールにも従ってください。\n${imageTriggerPrompt}\n\n以上の設定とルールに基づき、ユーザーからの以下の質問に答えてください。`;
    const chat = model.startChat({
      history: history || [],
      generationConfig: { maxOutputTokens: 1000 },
    });
    const result = await chat.sendMessage(fullPrompt + "\n\n質問: " + question);
    const aiReplyText = result.response.text();
    res.json({ reply: aiReplyText });
  } catch (error) {
    console.error('チャット処理中にエラーが発生しました:', error);
    res.status(500).json({ error: 'AIとの通信中にエラーが発生しました。' });
  }
});

// --- サーバーの起動 ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました。`);
});

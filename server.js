// ----------------------------------------------------------------
// 猫AIチャット バックエンドサーバー (一体型・最終完成版)
// ----------------------------------------------------------------

// 必要なライブラリを読み込む
const express = require('express');
// const cors = require('cors'); // もう使いません
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Expressアプリを初期化
const app = express();

// ▼▼▼▼▼ ここからが重要な追加部分 ▼▼▼▼▼

// このディレクトリにある静的ファイル(CSS, JS, 画像など)を提供する設定
app.use(express.static(__dirname));

// ルートURL('/')にアクセスが来たら、index.htmlを返す設定
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ▲▲▲▲▲ ここまで ▲▲▲▲▲

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

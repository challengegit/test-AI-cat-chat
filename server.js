// ----------------------------------------------------------------
// 猫AIチャット バックエンドサーバー (最適化版)
// ----------------------------------------------------------------

// 必要なライブラリを読み込む
const express = require('express');
const cors = require('cors'); // フロントエンドとバックエンドの通信を許可するおまじない
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs').promises; // ファイルを非同期で読み込むためのモジュール
const path = require('path');
require('dotenv').config(); // .envファイルから環境変数を読み込む

// Expressアプリを初期化
const app = express();

// ▼▼▼▼▼ CORS設定をシンプルで確実なものに変更 ▼▼▼▼▼
const frontendPort = 5500; // Live Serverが使用するポート
// Codespacesのホスト名からフロントエンドの完全なURLを構築
const frontendOrigin = `https://${process.env.CODESPACE_NAME}-${frontendPort}.app.github.dev`;

console.log(`フロントエンドのオリジンを許可します: ${frontendOrigin}`); // どのURLを許可するか確認用ログ

app.use(cors({
  origin: frontendOrigin
}));
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
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });
    const result = await chat.sendMessage(fullPrompt + "\n\n質問: " + question);
    const response = result.response;
    const aiReplyText = response.text();
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

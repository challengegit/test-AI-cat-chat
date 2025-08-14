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
app.use(cors()); // CORSを有効にする
app.use(express.json()); // JSONリクエストを扱えるようにする

// --- APIキーのセットアップ ---
// 環境変数からAPIキーを読み込む。これが一番安全な方法。
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  // キーが設定されていなければ、エラーを出してサーバーを停止する
  console.error("エラー: 環境変数に GEMINI_API_KEY が設定されていません。");
  process.exit(1);
}

// Google AIクライアントの初期化
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });


// --- メインのチャット処理API ---
// '/chat' というURLでPOSTリクエストを受け付ける
app.post('/chat', async (req, res) => {
  try {
    // フロントエンドから送られてきた情報を取得
    const { catId, question, history } = req.body;

    // 必須情報がなければエラーを返す
    if (!catId || !question) {
      return res.status(400).json({ error: '猫のIDと質問は必須です。' });
    }

    // 1. 猫のプロフィールテキストファイルを読み込む
    const catProfilePath = path.join(__dirname, 'data', `${catId}.txt`);
    const profileText = await fs.readFile(catProfilePath, 'utf-8');
    
    // 2. テキストファイルの内容を分解して、AIへの指示（プロンプト）を作成
    const parts = profileText.split('---');
    const systemPrompt = parts[1]?.trim() || ''; // ## 基本プロフィール
    const imageTriggerPrompt = parts[2]?.trim() || ''; // ## 画像トリガー
    
    // AIへの最終的な指示を組み立てる
    const fullPrompt = `
      ${systemPrompt}
      
      あなたは以上の設定に完璧になりきってください。
      さらに、以下のルールにも従ってください。
      ${imageTriggerPrompt}
      
      以上の設定とルールに基づき、ユーザーからの以下の質問に答えてください。
    `;

    // 3. Gemini APIとの対話を開始
    const chat = model.startChat({
        history: history || [], // 会話履歴があれば引き継ぐ
        generationConfig: {
          maxOutputTokens: 1000,
        },
    });
    
    // 4. 指示と質問をAIに送信
    const result = await chat.sendMessage(fullPrompt + "\n\n質問: " + question);
    const response = result.response;
    const aiReplyText = response.text();

    // 5. AIからの返答をフロントエンドに送り返す
    res.json({ reply: aiReplyText });

  } catch (error) {
    console.error('チャット処理中にエラーが発生しました:', error);
    res.status(500).json({ error: 'AIとの通信中にエラーが発生しました。' });
  }
});

// --- サーバーの起動 ---
const PORT = process.env.PORT || 10000; // CodespacesやRenderが指定するポートで起動
app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました。`);
});

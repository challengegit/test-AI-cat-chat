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
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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


// --- メインのチャット処理API ---
app.post('/chat', async (req, res) => {
  try {
    const { catId, question, history } = req.body;
    if (!catId || !question) {
      return res.status(400).json({ error: '猫のIDと質問は必須です。' });
    }

    // --- ★★★ ここからが修正箇所です ★★★ ---

    // Step 1: 全猫の基本情報を背景知識として生成
    const dataDir = path.join(__dirname, 'data');
    const allCatFiles = await fs.readdir(dataDir);
    const catTxtFiles = allCatFiles.filter(file => file.endsWith('.txt'));

    let allCatsKnowledge = "あなたは、以下の猫たちと一緒に暮らしています。他の猫について質問された場合は、この情報を基に、あなた自身のキャラクターとして自然な口調で答えてください。\n\n";
    
    const order = ['pino', 'teto', 'ruka', 'abi', 'bell', 'rate'];
    const sortedCatFiles = catTxtFiles.sort((a, b) => order.indexOf(path.parse(a).name) - order.indexOf(path.parse(b).name));

    for (const file of sortedCatFiles) {
      const content = await fs.readFile(path.join(dataDir, file), 'utf-8');
      const profileInfo = {};
      const lines = content.split('---')[0].split('\n');
      lines.forEach(line => {
        const [key, ...value] = line.split(':');
        if (key && value.length > 0) {
          profileInfo[key.trim()] = value.join(':').trim();
        }
      });
      // AIに与えるための簡潔な情報リストを作成
      allCatsKnowledge += `- 名前: ${profileInfo.name}, 性別: ${profileInfo.gender}, 年齢: ${profileInfo.age}\n`;
    }

    // Step 2: 選択された猫のペルソナプロンプトを読み込む
    const catProfilePath = path.join(__dirname, 'data', `${catId}.txt`);
    const profileText = await fs.readFile(catProfilePath, 'utf-8');
    const parts = profileText.split('---');
    const systemPrompt = parts[1]?.trim() || ''; // あなたの基本設定
    const imageTriggerPrompt = parts[2]?.trim() || ''; // 画像トリガー

    // Step 3: 背景知識とペルソナを結合して最終的なプロンプトを作成
    const fullPrompt = `${allCatsKnowledge}\n---\n\n${systemPrompt}\n\nあなたは以上の設定に完璧になりきってください。\nさらに、以下のルールにも従ってください。\n${imageTriggerPrompt}\n\n以上の設定とルールに基づき、ユーザーからの以下の質問に答えてください。`;
    
    // --- ★★★ 修正箇所はここまでです ★★★ ---

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

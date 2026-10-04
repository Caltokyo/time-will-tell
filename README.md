# TIME WILL TELL — Landing Page

ビルド不要の静的LPです（HTML / CSS / JavaScript のみ）。

## ローカルで見る

```bash
npx serve .
# または
python3 -m http.server 8000
```

## ファイル

- `index.html` — ページ構成とコピー
- `styles.css` — デザイン（色・フォントは `:root` の変数で調整）
- `main.js` — 東京時間のライブ時計、スクロール演出、カウントアップ
- `assets/` — favicon など

## 差し替えが必要な箇所

- `index.html` の Contact ボタンの `href="#"`（TODOコメントあり）を実際の問い合わせ先に変更してください。
- コピーはコンセプト用の仮テキストです。事業内容に合わせて書き換えてください。

## デプロイ

Vercel / Netlify / GitHub Pages などにそのまま置けます（ビルドコマンド不要、公開ディレクトリはリポジトリルート）。

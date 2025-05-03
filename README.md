# AWS 証明書画像処理 Lambda サービス

## プロジェクト概要

このプロジェクトは、AWS Lambda と AWS SAM を使用して証明書画像に文字や印鑑を合成する画像処理サービスです。S3 バケットに保存されているベース画像に対して、テキスト情報と印鑑画像を配置し、合成した画像を S3 に保存します。生成された画像は署名付き URL を通じてダウンロード可能です。

## 機能概要

- ベース証明書画像にテキスト（有効期限、発行者名、署名など）を追加
- 印鑑画像を合成
- 処理済み画像を S3 バケットに保存
- 処理済み画像の S3 署名付き URL を返却
- AWS SAM を使用した簡単なデプロイ

## 技術スタック

- AWS Lambda
- Amazon S3
- API Gateway
- AWS SAM (Serverless Application Model)
- Node.js 20
- TypeScript
- Sharp ライブラリ（画像処理）
- Docker

## プロジェクト構成

```
aws_imagedit_lambda/
├── sam-app/                    # AWS SAM アプリケーション
│   ├── image-processing/       # Lambda 関数ソースコード
│   │   ├── app.ts              # メイン処理コード
│   │   ├── package.json        # 依存関係定義
│   │   ├── tsconfig.json       # TypeScript 設定
│   │   ├── Dockerfile          # コンテナイメージ定義
│   │   └── fonts/              # フォントディレクトリ
│   │       └── NotoSansJP-Regular.otf  # 日本語フォント
│   ├── template.yaml           # SAM テンプレート（インフラ定義）
│   ├── samconfig.toml          # SAM デプロイ設定
│   └── events/                 # テスト用イベント
├── infra/                      # インフラストラクチャコード（オプション）
└── lambda-layer-fonts.zip      # フォントレイヤー用 ZIP ファイル
```

## 前提条件

- AWS CLI のインストールと設定
- AWS SAM CLI のインストール
- Node.js 20 以上
- Docker のインストール
- AWS アカウントと適切な権限

## セットアップと開発

### 開発環境セットアップ

1. リポジトリのクローン

```bash
git clone <リポジトリURL>
cd aws_imagedit_lambda
```

2. 依存関係のインストール

```bash
cd sam-app/image-processing
npm install
```

3. TypeScript のコンパイル

```bash
npm run build
```

### ローカルでのテスト

SAM CLI を使用してローカルでの関数テストが可能です：

```bash
# sam-app ディレクトリに移動
cd sam-app

# ビルド
sam build

# ローカルでの Lambda 関数実行
sam local invoke ImageProcessingFunction --event events/event.json --env-vars env.json

# または API のローカル起動
sam local start-api
curl http://localhost:3000/image-processing
```

#### ローカルテストの注意点

ローカル実行時に以下の問題が発生する可能性があります：

1. **フォント関連の問題**： フォントファイルへのパス解決が必要です。

   ```bash
   sam local invoke ImageProcessingFunction -v ./image-processing/fonts:/var/task/fonts
   ```

2. **環境変数設定**： `env.json` に必要な環境変数を設定します。

   ```json
   {
     "ImageProcessingFunction": {
       "BUCKET_NAME": "your-bucket-name"
     }
   }
   ```

3. **AWS 認証情報**： ローカルから S3 バケットにアクセスするには適切な AWS 認証情報が必要です。
   ```bash
   export AWS_PROFILE=your-profile
   ```

### AWS へのデプロイ

1. AWS SAM を使用したビルド

```bash
cd sam-app
sam build
```

2. デプロイ（初回は対話形式）

```bash
sam deploy --guided
```

3. 環境別のデプロイ（開発/テスト/本番）

```bash
# 開発環境へのデプロイ
sam deploy --config-env dev

# テスト環境へのデプロイ
sam deploy --config-env test

# 本番環境へのデプロイ
sam deploy --config-env prod
```

## 使用方法

デプロイ後、以下の API エンドポイントにリクエストを送信することで証明書画像を生成できます：

```
POST https://<API-ID>.execute-api.<リージョン>.amazonaws.com/<ステージ名>/image-processing
```

### レスポンス例

```json
{
  "imageUrl": "https://your-bucket.s3.ap-northeast-1.amazonaws.com/dist/processed_2023-05-01T12-34-56-789Z_card.png?X-Amz-Algorithm=...",
  "message": "画像URLにアクセスして画像をダウンロードしてください"
}
```

## カスタマイズ

### 1. テキストとレイアウトのカスタマイズ

`app.ts` の `lambdaHandler` 関数内で、`addText` の呼び出しパラメータを変更することで、テキスト内容やレイアウトをカスタマイズできます：

```typescript
await addText(compositeOperations, 'カスタムテキスト', x, y, {
  fontSize: 32,
  color: '#FF0000',
  // その他のオプション
});
```

### 2. 印鑑画像の変更

S3 バケット内の印鑑画像を変更するか、`app.ts` 内の S3 パスを変更します：

```typescript
const getInsertImageCommand = new GetObjectCommand({
  Bucket: process.env.BUCKET_NAME,
  Key: `${baseDir}/your-stamp-image.png`,
});
```

### 3. AWS リソースのカスタマイズ

`template.yaml` を編集して、Lambda 関数のメモリサイズやタイムアウト、API Gateway の設定などをカスタマイズできます。

## トラブルシューティング

1. **TypeScript のコンパイルエラー**：

   - `tsconfig.json` の設定を確認
   - 最新の TypeScript バージョンを使用しているか確認

2. **Lambda 関数の実行エラー**：

   - CloudWatch Logs でエラー内容を確認
   - `BUCKET_NAME` などの環境変数が正しく設定されているか確認

3. **フォント表示の問題**：

   - フォントファイルが正しくパッケージングされているか確認
   - Lambda レイヤーを使用している場合はレイヤーが正しく設定されているか確認

4. **画像処理の遅延**：
   - Lambda 関数のメモリサイズを増やすことで処理速度を改善（`template.yaml` の `MemorySize` パラメータ）

## 参考リンク

- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [AWS SAM ドキュメント](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Sharp ライブラリのドキュメント](https://sharp.pixelplumbing.com/)

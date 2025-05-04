# AWS 証明書画像処理サービス インフラストラクチャ

このディレクトリには AWS CDK (Cloud Development Kit) を使用した証明書画像処理サービスのインフラストラクチャコードが含まれています。

## プロジェクト構成

```
infra/
├── bin/                    # CDKアプリケーションのエントリーポイント
│   └── infra.ts           # メインCDKアプリ定義
├── lib/                    # CDKスタック定義
│   └── infra-stack.ts     # インフラ全体を管理するスタック
├── constructs/             # カスタムCDKコンストラクト
│   ├── apigateway-construct.ts  # API Gateway関連の定義
│   ├── lambda-construct.ts      # Lambda関数関連の定義
│   └── s3-construct.ts          # S3バケット関連の定義
└── config/                 # 環境設定
    └── environment.ts      # 環境変数定義と検証
```

## セットアップと使用方法

### 前提条件

- Node.js 16 以上
- AWS CLI 設定済み
- AWS CDK インストール済み (`npm install -g aws-cdk`)
- `.env`ファイルに環境変数を設定（必須項目: AWS_ACCOUNT_ID, S3_BUCKET_NAME, API_GATEWAY_NAME, API_GATEWAY_STAGE, LAMBDA_FUNCTION_NAME, TAG_ENVIRONMENT, TAG_OWNER）

### 基本的なコマンド

- `npm run build` TypeScript のコンパイル
- `npm run watch` 変更を監視して自動コンパイル
- `npm run test` Jest テストの実行
- `npx cdk deploy` AWS アカウント/リージョンにスタックをデプロイ
- `npx cdk diff` デプロイ済みスタックと現在の状態を比較
- `npx cdk synth` CloudFormation テンプレートを生成

## 主要コンポーネント

このインフラは以下の AWS リソースを作成・管理します：

1. **S3 バケット** - 証明書画像の保存用
2. **Lambda 関数** - 画像処理ロジックを実行
3. **API Gateway** - Lambda 関数への HTTP アクセスを提供

## 環境設定

`config/environment.ts`では、Zod を使用して環境変数のバリデーションと型安全な管理を行っています。環境変数は`.env`ファイルから読み込まれます。

## デプロイ方法

```bash
# 必要なパッケージのインストール
npm install

# CDKブートストラップ（初回のみ）
npx cdk bootstrap

# デプロイ
npx cdk deploy
```

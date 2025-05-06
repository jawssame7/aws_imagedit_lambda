# 画像処理 Lambda 関数 - 証明書合成サービス

この画像処理サービスは、AWS Lambda を利用して証明書に文字と印鑑を合成するアプリケーションです。S3 バケットに保存されているベース画像に対して、テキスト情報と印鑑画像を配置し、合成した画像を S3 に保存します。

## 機能概要

- ベース証明書画像に有効期限を追加
- 発行者名を追加
- 署名を追加
- 印鑑画像を合成
- 処理済み画像の S3 署名付き URL を返却

## 技術スタック

- AWS Lambda
- Amazon S3
- API Gateway
- Node.js 20
- TypeScript
- sharp（画像処理ライブラリ）
- AWS SDK for JavaScript v3

## プロジェクト構成

```
sam-app/
├── image-processing/          # Lambda関数ソースコード
│   ├── app.ts                 # メイン処理コード
│   ├── package.json           # 依存関係定義
│   ├── Dockerfile             # コンテナイメージ定義
│   └── fonts/                 # フォントディレクトリ
│       └── NotoSansJP-Regular.otf  # 日本語フォント
├── template.yaml              # SAMテンプレート
└── events/                    # テスト用イベント
```

## 使用方法

### 前提条件

- AWS CLI がインストールされており、設定済みであること
- SAM CLI がインストールされていること
- Node.js 20 以上がインストールされていること
- Docker がインストールされていること

### 開発環境セットアップ

1. 依存関係のインストール

```bash
cd image-processing
npm install
```

2. TypeScript のコンパイル

```bash
npm run build
```

TypeScript コードがコンパイルされると、`dist` ディレクトリに JavaScript ファイルが生成されます。

### デプロイ手順

1. プロジェクトをビルド（SAM CLI が自動的に TypeScript コンパイルも行います）

```bash
sam build
```

2. デプロイ（初回は対話形式で設定）

```bash
sam deploy --guided
```

3. デプロイ後のスタック情報を確認

```bash
aws cloudformation describe-stacks --stack-name <スタック名>
```

### 環境ごとのデプロイ設定

本プロジェクトでは `samconfig.toml` ファイルを使用して開発(dev)、テスト(test)、本番(prod)の 3 つの環境設定を管理しています。

#### 設定内容

samconfig.toml ファイルには以下の環境設定が含まれています:

```toml
# デフォルト設定（共通設定）
[default.deploy.parameters]
resolve_s3 = true
confirm_changeset = true
capabilities = "CAPABILITY_IAM"
region = "ap-northeast-1"

# 開発環境の設定
[dev.deploy.parameters]
stack_name = "sam-app-dev"
s3_prefix = "sam-app-dev"
disable_rollback = true
parameter_overrides = "BucketName=\"testbucket-devsame73-dev\" Env=\"dev\" MemorySize=\"256\" EnableDetailedMonitoring=\"false\""
# ... 他の設定 ...

# テスト環境の設定
[test.deploy.parameters]
stack_name = "sam-app-test"
# ... テスト環境固有の設定 ...

# 本番環境の設定
[prod.deploy.parameters]
stack_name = "sam-app-prod"
disable_rollback = false  # 本番ではロールバックを有効化
# ... 本番環境固有の設定 ...
```

#### デプロイ方法

各環境へのデプロイは以下のコマンドで行います：

```bash
# 開発環境にデプロイ
sam deploy --config-env dev

# テスト環境にデプロイ
sam deploy --config-env test

# 本番環境にデプロイ
sam deploy --config-env prod
```

これらのコマンドを実行すると、samconfig.toml ファイルの該当する環境設定が適用され、各環境に応じたパラメータでスタックがデプロイされます。環境ごとに異なるスタック名が使用されるため、AWS コンソールでも環境を明確に区別して管理できます。

#### 環境差分のカスタマイズ

環境ごとの差分は主に以下の要素を使って制御しています：

1. **スタック名**: 環境ごとに異なる CloudFormation スタック名を使用
2. **パラメータ**: BucketName, MemorySize, MonitoringLevel などを環境ごとに設定
3. **ロールバック設定**: 本番環境ではデプロイ失敗時に自動ロールバック

template.yaml では、これらのパラメータを受け取り、条件付きで機能を有効/無効にします：

```yaml
Conditions:
  IsProd: !Equals [!Ref Env, 'prod']
  IsTest: !Equals [!Ref Env, 'test']
  IsDev: !Equals [!Ref Env, 'dev']
  IsDetailedMonitoring: !Equals [!Ref EnableDetailedMonitoring, 'true']
```

環境ごとの設定値を変更する場合は、samconfig.toml の対応する環境セクションを編集してください。

### API の利用方法

デプロイ後に生成される API エンドポイントに HTTP リクエストを送信します：

```
GET https://<API ID>.execute-api.<リージョン>.amazonaws.com/Prod/process
```

#### レスポンス例

```json
{
  "imageUrl": "https://your-bucket.s3.ap-northeast-1.amazonaws.com/dist/processed_2023-05-01T12-34-56-789Z_card.png?X-Amz-Algorithm=...",
  "message": "画像URLにアクセスして画像をダウンロードしてください"
}
```

### ローカルでのテスト

TypeScript コードを変更した場合は、まずコンパイルする必要があります：

```bash
cd image-processing
npm run build
```

その後、以下のコマンドでローカルテストができます：

```bash
# ビルド
sam build

# ローカルでLambda関数を実行
sam local invoke ImageProcessingFunction --event events/event.json

# ローカルでAPIをテスト
sam local start-api
curl http://localhost:3000/process
```

#### ローカル実行時の注意点

ローカルでのテスト実行時に以下の問題が発生する可能性があります：

1. **フォントファイルのアクセス問題**：
   ローカル環境では、Docker コンテナ内のフォントパスが実際の環境と異なる場合があります。
   対処法：`sam local invoke` 実行時に `-v` オプションでフォントディレクトリをマウントします。

   ```bash
   sam local invoke ImageProcessingFunction -v ./image-processing/fonts:/var/task/fonts --event events/event.json
   ```

2. **S3 バケットアクセスの問題**：
   ローカル環境から実際の S3 バケットにアクセスするには、適切な AWS 認証情報が必要です。
   対処法：以下の環境変数を設定してください。

   ```bash
   export AWS_PROFILE=your-profile-name
   ```

   または、テスト用のダミーイベントデータを用意して、S3 アクセスをモックします。

3. **環境変数の不足**：
   Lambda 関数が必要とする環境変数（`BUCKET_NAME`など）が設定されていない可能性があります。
   対処法：環境変数ファイルを作成し、実行時に読み込みます。

   ```bash
   # env.json を作成
   {
     "ImageProcessingFunction": {
       "BUCKET_NAME": "your-bucket-name"
     }
   }

   # 環境変数ファイルを指定して実行
   sam local invoke ImageProcessingFunction --event events/event.json --env-vars env.json
   ```

4. **コンテナビルドの問題**：
   Dockerfile のカスタマイズが必要な場合、ローカルビルドに反映されない場合があります。
   対処法：`--skip-pull-image` オプションを使って既存のイメージを使用します。
   ```bash
   sam local invoke ImageProcessingFunction --skip-pull-image --event events/event.json
   ```

これらの問題を回避するため、開発中は実際の AWS 環境にデプロイしてテストするか、S3 アクセスなどの外部依存をモックしたテスト用イベントを使用することをお勧めします。

## カスタマイズ方法

### テキスト内容の変更

`app.ts`の`lambdaHandler`関数内で、`addText`関数の呼び出し部分を編集します。

### 画像パスの変更

S3 バケット内のパスを変更する場合は、`app.ts`内の以下の変数を編集します：

```typescript
const baseDir = 'base_image';
const fileName = 'card.png';
```

### フォントの変更

1. 新しいフォントファイルを`fonts/`ディレクトリに配置
2. `app.ts`内のフォントパス指定を変更
3. 再ビルドおよびデプロイ

## トラブルシューティング

- **フォントエラー**: フォントファイルが正しくコンテナ内に配置されていることを確認してください
- **S3 アクセスエラー**: Lambda 関数の IAM ロールが S3 バケットへの読み書き権限を持っていることを確認してください
- **画像処理エラー**: 入力画像形式が正しいか、sharp ライブラリがサポートしている形式かを確認してください
- **コンパイルエラー**: TypeScript コードを変更後、`npm run build` でコンパイルエラーがないか確認してください

### ECR リポジトリエラー

`sam deploy` 実行時に以下のようなエラーが発生した場合：

```
Error: Unable to upload artifact imageprocessingfunction:nodejs20-v1 referenced by ImageUri parameter of ImageProcessingFunction resource.
error from registry: The repository with name 'samapp-dev/imageprocessingfunction' does not exist in the registry with id '703671935472'
```

これは、SAM が Docker イメージをプッシュしようとした際に、指定された ECR リポジトリが存在しないために発生します。

以下のコマンドを実行して、ECR リポジトリを手動で作成してください（リージョンは適宜変更してください）:

```bash
aws ecr create-repository --repository-name samapp-dev/imageprocessingfunction --region ap-northeast-1
```

リポジトリを作成後、再度 `sam deploy` コマンドを実行してください。

### IAM ケーパビリティエラー

以下のようなエラーが発生した場合：

```
Error: Failed to create changeset for the stack: sam-app-dev, ex: Waiter ChangeSetCreateComplete failed:
Waiter encountered a terminal failure state: For expression "Status" we matched expected path: "FAILED"
Status: FAILED. Reason: Requires capabilities : [CAPABILITY_IAM]
```

これは、CloudFormation スタックに IAM リソースを作成するために必要な権限設定が不足しているために発生するエラーです。以下の方法で解決できます：

1. **コマンドに `--capabilities` フラグを追加する**:

   ```bash
   sam deploy --config-env dev --capabilities CAPABILITY_IAM
   ```

2. **samconfig.toml の設定を確認する**:
   samconfig.toml ファイルで各環境に `capabilities = "CAPABILITY_IAM"` が設定されていることを確認します：

   ```toml
   [dev.deploy.parameters]
   stack_name = "sam-app-dev"
   s3_prefix = "sam-app-dev"
   capabilities = "CAPABILITY_IAM"  # この行が存在することを確認
   # 他の設定...
   ```

3. **デプロイ時に表示される設定を確認する**:
   デプロイ時に表示される設定情報で、`Capabilities` が `null` になっていないことを確認します。
   もし `null` になっている場合は、コマンドラインで明示的に指定する必要があります。

このエラーは通常、IAM リソースを作成または変更する権限が CloudFormation に与えられていない場合に発生します。適切な権限設定を行うことで解決できます。

## クリーンアップ

プロジェクトを削除するには以下のコマンドを実行します：

```bash
sam delete --stack-name <スタック名>
```

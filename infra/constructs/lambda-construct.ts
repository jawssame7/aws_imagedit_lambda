import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import { env } from '../config/environment';

// Lambda関数用のカスタムコンストラクト
export interface LambdaConstructProps {
  functionName: string; // Lambda関数名
  samPath: string; // SAMアプリケーションのルートパス
  handler?: string; // オプショナルなハンドラー（デフォルト: app.lambdaHandler）
  runtime?: lambda.Runtime; // オプショナルなランタイム（デフォルト: NODEJS_22_X）
  bucketName: string; // S3バケット名
}

export class LambdaConstruct extends Construct {
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    // SAMビルドパスの設定
    const samBuildPath = path.join(props.samPath, '.aws-sam/build');

    // ログ保持期間を日数からCDKのenumに変換
    const getLogRetention = (days: number): logs.RetentionDays => {
      switch (days) {
        case 1:
          return logs.RetentionDays.ONE_DAY;
        case 3:
          return logs.RetentionDays.THREE_DAYS;
        case 5:
          return logs.RetentionDays.FIVE_DAYS;
        case 7:
          return logs.RetentionDays.ONE_WEEK;
        case 14:
          return logs.RetentionDays.TWO_WEEKS;
        case 30:
          return logs.RetentionDays.ONE_MONTH;
        case 60:
          return logs.RetentionDays.TWO_MONTHS;
        case 90:
          return logs.RetentionDays.THREE_MONTHS;
        case 120:
          return logs.RetentionDays.FOUR_MONTHS;
        case 150:
          return logs.RetentionDays.FIVE_MONTHS;
        case 180:
          return logs.RetentionDays.SIX_MONTHS;
        case 365:
          return logs.RetentionDays.ONE_YEAR;
        case 400:
          return logs.RetentionDays.THIRTEEN_MONTHS;
        case 545:
          return logs.RetentionDays.EIGHTEEN_MONTHS;
        case 731:
          return logs.RetentionDays.TWO_YEARS;
        case 1827:
          return logs.RetentionDays.FIVE_YEARS;
        case 3653:
          return logs.RetentionDays.TEN_YEARS;
        default:
          return logs.RetentionDays.TWO_WEEKS; // デフォルト値
      }
    };

    // Lambda関数のリソースを作成
    this.lambdaFunction = new lambda.Function(this, 'LambdaFunction', {
      functionName: props.functionName,
      runtime: props.runtime || lambda.Runtime.NODEJS_22_X,
      handler: props.handler || 'app.lambdaHandler',
      code: lambda.Code.fromAsset(samBuildPath), // SAMビルド成果物のパス
      memorySize: env.LAMBDA_MEMORY_SIZE,
      timeout: cdk.Duration.seconds(env.LAMBDA_TIMEOUT),
      environment: {
        ...env.LAMBDA_ENVIRONMENT_VARIABLES,
        BUCKET_NAME: props.bucketName,
      },
      tracing: env.ENABLE_XRAY
        ? lambda.Tracing.ACTIVE
        : lambda.Tracing.DISABLED,
      logRetention: getLogRetention(env.LAMBDA_LOG_RETENTION_DAYS),
    });

    // S3バケットへのアクセス権限を追加
    this.lambdaFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [`arn:aws:s3:::${props.bucketName}/*`],
      })
    );
  }
}

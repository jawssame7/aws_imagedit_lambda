import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { env } from '../config/environment';

// S3バケット用のカスタムコンストラクト
export interface S3ConstructProps {
  bucketName: string; // バケット名
}

export class S3Construct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3ConstructProps) {
    super(scope, id);

    // S3バケットのリソースを作成
    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: props.bucketName, // 環境変数から取得
      versioned: env.S3_VERSIONING_ENABLED, // バージョニング有効化
      removalPolicy:
        env.ENV === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY, // 本番はRETAIN、開発はDESTROY
      autoDeleteObjects: env.ENV !== 'prod', // 開発時のみ自動削除
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(env.S3_LIFECYCLE_EXPIRATION_DAYS), // ライフサイクルルール
        },
      ],
    });
  }
}

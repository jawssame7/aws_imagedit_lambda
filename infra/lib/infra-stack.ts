import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LambdaConstruct } from '../constructs/lambda-construct';
import { ApiGatewayConstruct } from '../constructs/apigateway-construct';
import { S3Construct } from '../constructs/s3-construct';
import { env, defaultTags } from '../config/environment';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

// インフラ全体を管理するCDKスタック
export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    // AWSアカウント・リージョン・タグを環境変数から設定
    super(scope, id, {
      ...props,
      env: {
        account: env.AWS_ACCOUNT_ID,
        region: env.AWS_REGION,
      },
      tags: defaultTags,
    });

    // Lambda関数のデプロイ
    const lambda = new LambdaConstruct(this, 'MyLambda', {
      functionName: env.LAMBDA_FUNCTION_NAME,
      samPath: '../sam-app',
      bucketName: env.S3_BUCKET_NAME,
    });

    // S3バケットのデプロイ
    const s3 = new S3Construct(this, 'MyBucket', {
      bucketName: env.S3_BUCKET_NAME, // 環境変数から取得
    });

    // API Gatewayのデプロイ
    const api = new ApiGatewayConstruct(this, 'MyApi', {
      restApiName: env.API_GATEWAY_NAME,
      lambdaFunction: lambda.lambdaFunction,
    });

    // API GatewayとLambdaの統合（POSTメソッドのみ）
    const integration = new cdk.aws_apigateway.LambdaIntegration(
      lambda.lambdaFunction
    );
    api.api.root.addMethod('POST', integration); // POSTのみ許可

    // S3バケットへのアクセス権限をLambdaに付与
    s3.bucket.grantReadWrite(lambda.lambdaFunction);

    // example resource
    // const queue = new sqs.Queue(this, 'InfraQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}

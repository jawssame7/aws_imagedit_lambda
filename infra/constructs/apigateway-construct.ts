import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { env } from '../config/environment';
import * as cdk from 'aws-cdk-lib';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { z } from 'zod';

// API Gateway用のカスタムコンストラクト
export interface ApiGatewayConstructProps {
  restApiName: string; // API Gateway名
  lambdaFunction: lambda.IFunction; // 統合するLambda関数
}

export class ApiGatewayConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayConstructProps) {
    super(scope, id);

    // SSL証明書の設定（オプション）
    let domainOptions: apigateway.DomainNameOptions | undefined;
    if (env.SSL_CERTIFICATE_ARN && env.DOMAIN_NAME) {
      const certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        env.SSL_CERTIFICATE_ARN
      );
      domainOptions = {
        certificate,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
        domainName: env.DOMAIN_NAME,
      };
    }

    // API Gatewayのリソースを作成
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: props.restApiName, // 環境変数から取得
      deployOptions: {
        stageName: env.API_GATEWAY_STAGE, // ステージ名
        throttlingRateLimit: env.API_GATEWAY_THROTTLING_RATE, // レート制限
        throttlingBurstLimit: env.API_GATEWAY_BURST_LIMIT, // バースト制限
        tracingEnabled: env.ENABLE_XRAY, // X-Ray
        metricsEnabled: env.ENABLE_CLOUDWATCH_DETAILED_MONITORING, // 詳細モニタリング
        loggingLevel: apigateway.MethodLoggingLevel.INFO, // ログレベル
      },
      defaultCorsPreflightOptions: env.API_GATEWAY_CORS_ENABLED
        ? {
            allowOrigins: env.API_GATEWAY_CORS_ORIGINS.split(','), // CORS許可オリジン
            allowMethods: ['POST', 'OPTIONS'], // POSTのみ許可
            allowHeaders: env.API_GATEWAY_CORS_HEADERS.split(','), // 許可ヘッダー
            maxAge: cdk.Duration.seconds(env.API_GATEWAY_CORS_MAX_AGE), // プリフライトキャッシュ
            allowCredentials: true, // 認証情報許可
          }
        : undefined,
      domainName: domainOptions, // カスタムドメイン（オプション）
    });

    // WAFの設定（オプション）
    if (env.ENABLE_WAF) {
      const waf = new wafv2.CfnWebACL(this, 'WebACL', {
        defaultAction: { allow: {} },
        scope: 'REGIONAL',
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: `${props.restApiName}-waf`,
          sampledRequestsEnabled: true,
        },
        rules: [
          {
            name: 'RateLimit',
            priority: 1,
            statement: {
              rateBasedStatement: {
                limit: env.WAF_RATE_LIMIT,
                aggregateKeyType: 'IP',
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: `${props.restApiName}-rate-limit`,
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'SQLInjectionProtection',
            priority: 2,
            statement: {
              sqliMatchStatement: {
                fieldToMatch: {
                  allQueryArguments: {},
                },
                sensitivityLevel: 'HIGH',
                textTransformations: [
                  {
                    priority: 0,
                    type: 'HTML_ENTITY_DECODE',
                  },
                ],
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: `${props.restApiName}-sqli-protection`,
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'XSSProtection',
            priority: 3,
            statement: {
              xssMatchStatement: {
                fieldToMatch: {
                  body: {},
                },
                textTransformations: [
                  {
                    priority: 0,
                    type: 'HTML_ENTITY_DECODE',
                  },
                ],
              },
            },
            action: { block: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: `${props.restApiName}-xss-protection`,
              sampledRequestsEnabled: true,
            },
          },
          {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 4,
            statement: {
              managedRuleGroupStatement: {
                name: 'AWSManagedRulesCommonRuleSet',
                vendorName: 'AWS',
                excludedRules: [],
              },
            },
            overrideAction: { none: {} },
            visibilityConfig: {
              cloudWatchMetricsEnabled: true,
              metricName: `${props.restApiName}-aws-managed-rules`,
              sampledRequestsEnabled: true,
            },
          },
        ],
      });

      new wafv2.CfnWebACLAssociation(this, 'WebACLAssociation', {
        resourceArn: this.api.deploymentStage.stageArn,
        webAclArn: waf.attrArn,
      });
    }

    // Lambda統合の設定
    const integration = new apigateway.LambdaIntegration(props.lambdaFunction, {
      proxy: true,
      allowTestInvoke: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Content-Security-Policy':
              "'default-src 'self'; script-src 'self'; object-src 'none'; img-src 'self' data:;'",
          },
        },
      ],
    });

    // ルートにPOSTメソッドを追加
    this.api.root.addMethod('POST', integration, {
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
            'method.response.header.Access-Control-Allow-Headers': true,
            'method.response.header.Access-Control-Allow-Methods': true,
            'method.response.header.Content-Security-Policy': true,
          },
          responseModels: {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
      ],
    });

    // Lambda関数にAPIGatewayからの呼び出し権限を付与
    props.lambdaFunction.addPermission('ApiGatewayInvoke', {
      principal: new cdk.aws_iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: this.api.arnForExecuteApi(),
    });
  }
}

// Lambda 関数内のハンドラーでの入力サニタイズと検証
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // リクエストボディの検証
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'リクエストボディが必要です' }),
      };
    }

    // JSONパース
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: '無効なJSONフォーマットです' }),
      };
    }

    // 入力値の検証（例: Zodを使用）
    const schema = z.object({
      // フィールドの定義と検証ルール
      name: z.string().min(1).max(100),
      email: z.string().email(),
      // 他のフィールド...
    });

    // 検証実行
    try {
      schema.parse(requestBody);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '入力値が無効です',
          errors: e instanceof z.ZodError ? e.errors : 'バリデーションエラー',
        }),
      };
    }

    // この時点で検証済みの安全なデータを処理
    // ...

    // 必ず戻り値を返す
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '処理が完了しました',
      }),
    };
  } catch (error) {
    // エラーハンドリング
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: '内部サーバーエラー',
        error: error instanceof Error ? error.message : '不明なエラー',
      }),
    };
  }
};

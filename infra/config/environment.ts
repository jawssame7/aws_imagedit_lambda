import * as dotenv from 'dotenv';
import { z } from 'zod';

// .envファイルを読み込む
dotenv.config();

// 環境変数のスキーマ定義
const envSchema = z.object({
  // AWS環境設定
  AWS_REGION: z.string().default('ap-northeast-1'),
  AWS_ACCOUNT_ID: z.string(),
  AWS_PROFILE: z.string().default('default'),

  // 環境識別子
  ENV: z.enum(['dev', 'stg', 'prod']).default('dev'),

  // S3設定
  S3_BUCKET_NAME: z.string(),
  S3_VERSIONING_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  S3_LIFECYCLE_EXPIRATION_DAYS: z.string().transform(Number).default('30'),

  // API Gateway設定
  API_GATEWAY_NAME: z.string(),
  API_GATEWAY_STAGE: z.string(),
  API_GATEWAY_CORS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  API_GATEWAY_CORS_ORIGINS: z.string().default('*'),
  API_GATEWAY_CORS_HEADERS: z
    .string()
    .default(
      'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    ),
  API_GATEWAY_CORS_MAX_AGE: z.string().transform(Number).default('300'),
  API_GATEWAY_THROTTLING_RATE: z.string().transform(Number).default('1000'),
  API_GATEWAY_BURST_LIMIT: z.string().transform(Number).default('2000'),

  // Lambda設定
  LAMBDA_FUNCTION_NAME: z.string(),
  LAMBDA_MEMORY_SIZE: z.string().transform(Number).default('256'),
  LAMBDA_TIMEOUT: z.string().transform(Number).default('30'),
  LAMBDA_LOG_RETENTION_DAYS: z.string().transform(Number).default('14'),
  LAMBDA_ENVIRONMENT_VARIABLES: z
    .string()
    .transform((val) => JSON.parse(val))
    .default('{}'),

  // 共通タグ
  TAG_PROJECT: z.string().default('sam-app'),
  TAG_ENVIRONMENT: z.string(),
  TAG_OWNER: z.string(),

  // セキュリティ設定
  ENABLE_WAF: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  WAF_RATE_LIMIT: z.string().transform(Number).default('2000'),
  SSL_CERTIFICATE_ARN: z.string().optional(),
  DOMAIN_NAME: z.string().optional(),

  // モニタリング設定
  ENABLE_XRAY: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ENABLE_CLOUDWATCH_DETAILED_MONITORING: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  ALARM_EMAIL: z.string().email().optional(),
});

// 環境変数の型定義
export type Env = z.infer<typeof envSchema>;

// 環境変数のバリデーションと取得
export const env = envSchema.parse(process.env);

// デフォルトタグの設定
export const defaultTags = {
  Project: env.TAG_PROJECT,
  Environment: env.TAG_ENVIRONMENT,
  Owner: env.TAG_OWNER,
};

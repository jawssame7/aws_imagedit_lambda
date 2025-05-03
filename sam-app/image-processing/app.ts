import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import * as fs from 'fs';

const s3Client = new S3Client({
  region: 'ap-northeast-1',
  endpoint: 'https://s3.ap-northeast-1.amazonaws.com',
});

/**
 * SVGを使用してテキストを画像に追加する関数
 * @param compositeOperations - sharpのcomposite操作のリスト
 * @param text - 追加するテキスト
 * @param x - SVG内のテキスト開始X座標
 * @param y - SVG内のテキスト開始Y座標
 * @param options - テキスト描画のオプション
 * @returns 生成されたSVG文字列
 */
export const addText = async (
  compositeOperations: sharp.OverlayOptions[] = [],
  text: string,
  x: number,
  y: number,
  options: {
    svgWidth?: number;
    svgHeight?: number;
    fontSize?: number;
    color?: string;
    compositeTop?: number;
    compositeLeft?: number;
  } = {}
): Promise<string> => {
  text = text || 'テキスト未指定';
  const {
    svgWidth = 700,
    svgHeight = 80,
    fontSize = 24,
    color = '#000000',
    compositeTop = 0,
    compositeLeft = 0,
  } = options;

  // フォントファイルの読み込み
  const fontPath = './fonts/NotoSansJP-Regular.otf';
  let fontDataB64 = '';
  try {
    const fontData = fs.readFileSync(fontPath);
    fontDataB64 = fontData.toString('base64');
    console.log('Font file loaded successfully.');
  } catch (e) {
    console.error('フォントファイルの読み込みに失敗しました:', fontPath, e);
    throw new Error(`Font file not found or unreadable: ${fontPath}`);
  }

  // SVG文字列の生成
  const svgText = `
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    @font-face {
      font-family: 'NotoSansJP';
      src: url('data:font/opentype;base64,${fontDataB64}') format('opentype');
      font-weight: normal;
      font-style: normal;
    }
    .text-style {
      font-family: 'NotoSansJP', sans-serif;
      font-size: ${fontSize}px;
      fill: ${color};
      dominant-baseline: hanging;
      text-anchor: start;
    }
  </style>
  <text x="${x}" y="${y}" class="text-style">${text}</text>
</svg>
`;

  // 合成操作リストに追加
  compositeOperations.push({
    input: Buffer.from(svgText),
    top: compositeTop,
    left: compositeLeft,
  });

  return svgText;
};

/**
 * 画像を合成する関数
 * @param compositeOperations - sharpのcomposite操作のリスト
 * @param overlayImage - 合成する画像（Bufferまたはパス）
 * @param x - 合成位置のX座標
 * @param y - 合成位置のY座標
 */
const addImage = async (
  compositeOperations: sharp.OverlayOptions[] = [],
  overlayImage: string | Buffer,
  x: number,
  y: number
): Promise<void> => {
  compositeOperations.push({
    input: overlayImage,
    top: y,
    left: x,
  });
};

/**
 * Lambda関数のハンドラー
 * 証明書画像にテキストと印鑑画像を合成する
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // ===== デバッグ用コード START =====
  // console.log('Checking /opt directory contents:');
  // try {
  //   const optContents = fs.readdirSync('/opt');
  //   console.log('/opt contents:', optContents);
  //   if (optContents.includes('fonts')) {
  //     console.log('Checking /opt/fonts directory contents:');
  //     try {
  //       const fontsContents = fs.readdirSync('/opt/fonts');
  //       console.log('/opt/fonts contents:', fontsContents);
  //     } catch (fontError: any) {
  //       console.error('Error reading /opt/fonts directory:', fontError.message);
  //     }
  //   } else {
  //     console.log('/opt/fonts directory does not exist.');
  //   }
  // } catch (optError: any) {
  //   console.error('Error reading /opt directory:', optError.message);
  // }
  // ===== デバッグ用コード END =====

  try {
    // フォントファイルの存在確認
    const fontDir = '/opt/fonts';
    if (fs.existsSync(fontDir)) {
      console.log('fontsディレクトリの中身:', fs.readdirSync(fontDir));
    } else {
      console.log('fontsディレクトリが存在しません:', fontDir);
    }

    console.log('Environment variables:', process.env);

    // S3バケット設定
    const baseDir = 'base_image';
    const fileName = 'card.png';
    const fullPath = `${baseDir}/${fileName}`;
    let compositeOperations: sharp.OverlayOptions[] = [];

    // S3からベース画像を取得
    const getBaseCardImageCommand = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: fullPath,
    });

    // S3から印鑑画像を取得
    const getInsertImageCommand = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: `${baseDir}/20250502-1222-2.png`,
    });

    const response = await s3Client.send(getBaseCardImageCommand);
    // @ts-ignore
    const imageBuffer = await response.Body.transformToByteArray();

    const insertResponse = await s3Client.send(getInsertImageCommand);
    // @ts-ignore
    const insertImageBuffer = await insertResponse.Body.transformToByteArray();

    // SVGベースのテキスト追加に切り替え
    await addText(compositeOperations, '有効期限 2033年11月11日', 20, 30, {
      svgWidth: 700,
      svgHeight: 80,
      fontSize: 24,
      color: '#333333',
      compositeTop: 538,
      compositeLeft: 125,
    });

    // 発行者名テキストの追加
    await addText(compositeOperations, '発行者 山田 太郎', 20, 30, {
      svgWidth: 400,
      svgHeight: 80,
      fontSize: 24,
      color: '#333333',
      compositeTop: 585,
      compositeLeft: 125,
    });

    // 署名テキストの追加
    await addText(compositeOperations, '佐藤 雄一', 20, 40, {
      svgWidth: 400,
      svgHeight: 100,
      fontSize: 40,
      color: '#000000',
      compositeTop: 572,
      compositeLeft: 450,
    });

    // 印鑑画像の追加
    await addImage(
      compositeOperations,
      Buffer.from(insertImageBuffer),
      640,
      580
    );

    // 画像の合成処理実行
    const processedImageBuffer = await sharp(imageBuffer)
      .composite(compositeOperations)
      .toBuffer();

    // 常にS3にアップロード
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const processedFileName = `processed_${timestamp}_${fileName}`;
    const processedPath = `dist/${processedFileName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: processedPath,
        Body: processedImageBuffer,
        ContentType: 'image/png',
      })
    );

    // 処理済み画像の署名付きURLを生成
    const getProcessedCommand = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: processedPath,
    });

    const signedUrl = await getSignedUrl(s3Client, getProcessedCommand, {
      expiresIn: 300,
    });

    // クエリパラメータからフォーマットを確認
    const queryParams = event.queryStringParameters || {};
    const outputFormat = queryParams.format?.toLowerCase() || 'json';

    if (outputFormat === 'json') {
      // JSONレスポンスを返す
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          imageUrl: signedUrl,
        }),
      };
    } else {
      // Postmanでも動作するように、リダイレクトではなくURLをJSON形式で返す
      // クライアント側でリダイレクトや画像表示を行うことを想定
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          imageUrl: signedUrl,
          message: '画像URLにアクセスして画像をダウンロードしてください',
        }),
      };
    }
  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: error.$metadata?.httpStatusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error processing image',
        error: error.message,
      }),
    };
  }
};

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
 * @returns 生成されたSVG文字列 -> Bufferに変更
 */
export const addText = async (
  compositeOperations: sharp.OverlayOptions[] = [],
  text: string,
  x: number, // Note: x and y are less directly relevant now
  y: number, // Note: x and y are less directly relevant now
  options: {
    bufferWidth?: number; // Use bufferWidth/Height for clarity
    bufferHeight?: number;
    fontSize?: number;
    color?: string;
    compositeTop?: number;
    compositeLeft?: number;
  } = {}
): Promise<Buffer> => {
  // Return Buffer
  text = text || 'テキスト未指定';
  const {
    bufferWidth = 700,
    bufferHeight = 80,
    fontSize = 24, // Font size for Pango markup
    color = '#000000', // Color for Pango markup
    compositeTop = 0,
    compositeLeft = 0,
  } = options;

  // Font file is NOT read from filesystem here.

  try {
    // Create a transparent buffer and draw text onto it using sharp's text input
    const textBuffer = await sharp({
      create: {
        width: bufferWidth,
        height: bufferHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      },
    })
      .composite([
        {
          input: {
            text: {
              // Use Pango markup for basic styling. Escape input text.
              text: text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;'), // Plain text, still escape basic HTML entities just in case
              font: 'Noto Sans JP', // Rely on Fontconfig to find this font by name
              width: bufferWidth, // Use width for layout
              align: 'left',
              wrap: 'word', // Enable text wrapping
              rgba: true, // Ensure RGBA output for transparency
            },
          },
          gravity: 'northwest', // Place text at top-left within its buffer
        },
      ])
      .png() // Output as PNG to preserve transparency
      .toBuffer();

    // Add the created text buffer to the main composite list
    compositeOperations.push({
      input: textBuffer,
      top: compositeTop,
      left: compositeLeft,
    });

    console.log(`Text added: "${text}" at (${compositeLeft}, ${compositeTop})`);
    return textBuffer; // Return the buffer
  } catch (e: any) {
    console.error(`Error creating text buffer for "${text}":`, e);
    throw new Error(`Text buffer creation failed: ${e.message}`);
  }
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
  // console.log('Checking /var/task directory contents:');
  // try {
  //   const taskContents = fs.readdirSync('/var/task');
  //   console.log('/var/task contents:', taskContents);
  //   if (taskContents.includes('fonts')) {
  //     console.log('Checking /var/task/fonts directory contents:');
  //     try {
  //       const fontsContents = fs.readdirSync('/var/task/fonts');
  //       console.log('/var/task/fonts contents:', fontsContents);
  //     } catch (fontError: any) {
  //       console.error(
  //         'Error reading /var/task/fonts directory:',
  //         fontError.message
  //       );
  //     }
  //   } else {
  //     console.log('/var/task/fonts directory does not exist.');
  //   }
  // } catch (taskError: any) {
  //   console.error('Error reading /var/task directory:', taskError.message);
  // }
  // ===== デバッグ用コード END =====

  try {
    // フォントファイルの存在確認 (デバッグ用)
    // const fontDir = '/var/task/fonts'; // 正しいパスに変更
    // if (fs.existsSync(fontDir)) {
    //   console.log('fontsディレクトリの中身:', fs.readdirSync(fontDir));
    // } else {
    //   console.log('fontsディレクトリが存在しません:', fontDir);
    // }

    // console.log('Environment variables:', process.env);

    // シンプルにS3から画像を取得して返す
    // const getBaseCardImageCommand = new GetObjectCommand({
    //   Bucket: process.env.BUCKET_NAME,
    //   Key: 'base_image/card.png',
    // });
    // const response = await s3Client.send(getBaseCardImageCommand);

    // // Check if response.Body exists
    // if (!response.Body) {
    //   throw new Error('S3 object body is missing.');
    // }

    // const imageBuffer = await response.Body.transformToByteArray();
    // const base64Body = Buffer.from(imageBuffer).toString('base64');

    // // S3 Body は stream（ReadableStream）なので全て読み取る
    // const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    //   const chunks: Uint8Array[] = [];
    //   for await (const chunk of stream) {
    //     chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    //   }
    //   return Buffer.concat(chunks);
    // };

    // if (!response.Body) {
    //   throw new Error('S3 object body is missing.');
    // }

    // const imageBuffer = await streamToBuffer(response.Body as Readable);
    // const base64Body = imageBuffer.toString('base64');

    // // base64でエンコード済みの小さなPNG画像（赤1pxの例）
    // const base64Body =
    //   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8z8BQDwAFgwJ/lA5J7gAAAABJRU5ErkJggg==';

    // // このオブジェクトリテラルを直接 return する
    // return {
    //   statusCode: 200,
    //   headers: {
    //     'Content-Type': 'image/png',
    //     'Content-Disposition': 'attachment; filename="test.png"',
    //     'Access-Control-Allow-Origin': '*',
    //   },
    //   body: base64Body,
    //   isBase64Encoded: true,
    // };

    // クエリパラメータからフォーマットを確認
    const queryParams = event.queryStringParameters || {};
    let bodyParams: any = {}; // bodyParams の型を any に指定
    let message: string | undefined = undefined; // message を格納する変数を追加
    if (event.body) {
      try {
        bodyParams = JSON.parse(event.body);
        message = bodyParams?.message; // bodyParams から message を取得
      } catch (e) {
        console.warn('Could not parse request body:', event.body);
        bodyParams = {}; // パース失敗時は空オブジェクトに戻す
      }
    }
    // message が存在する場合、ログに出力する
    if (message) {
      console.log('Received message from POST body:', message);
      // 必要であれば、ここで message を使用する処理を追加
    }

    // formatパラメータをクエリ文字列またはボディから取得
    // bodyParams が any 型なので、format プロパティへのアクセスが許可される
    const outputFormat =
      queryParams.format?.toLowerCase() || bodyParams?.format?.toLowerCase(); // bodyParamsにもOptional Chainingを追加

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

    const [response, insertResponse] = await Promise.all([
      s3Client.send(getBaseCardImageCommand),
      s3Client.send(getInsertImageCommand),
    ]);

    // @ts-ignore - S3 Body ストリームを Buffer に変換
    const imageBuffer = await response.Body.transformToByteArray();
    // @ts-ignore
    const insertImageBuffer = await insertResponse.Body.transformToByteArray();

    // addText を使ってテキストレイヤーバッファを作成・追加
    await addText(compositeOperations, '有効期限 2033年11月11日', 0, 0, {
      // x, y are less relevant
      bufferWidth: 700,
      bufferHeight: 80,
      fontSize: 24,
      color: '#333333',
      compositeTop: 538,
      compositeLeft: 125,
    });

    await addText(compositeOperations, '発行者 山田 太郎', 0, 0, {
      bufferWidth: 400,
      bufferHeight: 80,
      fontSize: 24,
      color: '#333333',
      compositeTop: 585,
      compositeLeft: 125,
    });

    if (message) {
      await addText(compositeOperations, message, 0, 0, {
        bufferWidth: 400,
        bufferHeight: 100,
        fontSize: 40,
        color: '#000000',
        compositeTop: 572,
        compositeLeft: 450,
      });
    } else {
      await addText(compositeOperations, '佐藤 雄一', 0, 0, {
        bufferWidth: 400,
        bufferHeight: 100,
        fontSize: 40,
        color: '#000000',
        compositeTop: 572,
        compositeLeft: 450,
      });
    }

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

    // 常にS3にアップロード (バックアップや後で参照するため)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const processedFileName = `processed_${timestamp}_${fileName}`;
    const processedPath = `dist/${processedFileName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: processedPath,
        Body: processedImageBuffer, // アップロードするのは合成後のBuffer
        ContentType: 'image/png',
      })
    );

    if (outputFormat === 'download') {
      // 画像データを直接レスポンスボディに入れてダウンロードさせる

      // ★★★ ログ出力をここに追加 ★★★
      // console.log(
      //   `Processed image buffer length: ${processedImageBuffer.length}`
      // );
      // console.log(
      //   `Processed image buffer (first 8 bytes hex): ${processedImageBuffer
      //     .slice(0, 8)
      //     .toString('hex')}`
      // );

      return {
        statusCode: 200,
        headers: {
          // Content-Type を text/plain に変更 (Base64 文字列を送るため)
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="processed_output.png"`,
          'Access-Control-Allow-Origin': '*',
        },
        // レスポンスボディに *処理後の* 画像データを Base64 エンコードして設定
        body: processedImageBuffer.toString('base64'), // sharp は Buffer を返すので Buffer.from は不要
      };
    } else {
      // デフォルトまたは format=json の場合は署名付きURLを返す
      // 処理済み画像の署名付きURLを生成
      const getProcessedCommand = new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: processedPath,
      });

      // ★★★ ここからはログ出力を削除 ★★★
      // console.log(`Processed image buffer length: ${processedImageBuffer.length}`);
      // console.log(`Processed image buffer (first 8 bytes hex): ${processedImageBuffer.slice(0, 8).toString('hex')}`);

      const signedUrl = await getSignedUrl(s3Client, getProcessedCommand, {
        expiresIn: 300, // 5分間有効
      });

      // JSONレスポンスを返す
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          // CORS ヘッダーは SAM テンプレート側推奨
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          imageUrl: signedUrl,
          // format パラメータが指定されていない、または 'json' 以外で 'download' でもない場合のメッセージ
          message:
            outputFormat && outputFormat !== 'json'
              ? `formatパラメータが不正です。'json' または 'download' を指定してください。`
              : undefined,
        }),
      };
    }
  } catch (error: any) {
    console.error('Error:', error);
    // エラーレスポンス
    return {
      statusCode: error.$metadata?.httpStatusCode || 500,
      headers: {
        'Content-Type': 'application/json',
        // CORS ヘッダーは SAM テンプレート側推奨
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error processing image',
        error: error.message,
      }),
    };
  }
};

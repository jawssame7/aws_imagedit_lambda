document.addEventListener('DOMContentLoaded', () => {
  console.log('ページが読み込まれました。');

  const button = document.getElementById('colorChangeButton');
  if (button) {
    button.addEventListener('click', () => {
      document.body.style.backgroundColor =
        document.body.style.backgroundColor === 'rgb(240, 240, 240)'
          ? 'rgb(21, 160, 111)'
          : 'rgb(240, 240, 240)';
    });
  }

  const form = document.getElementById('dataForm');
  const responseMessage = document.getElementById('responseMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userInput = document.getElementById('userInput').value;

    try {
      const response = await fetch(
        'https://xxxxxxxxxxxxxxxxx?format=download',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userInput }),
        }
      );

      // レスポンスが成功したかチェック
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      // ★★★ Base64 文字列としてレスポンスを取得 ★★★
      const base64String = await response.text();
      console.log('Received base64 string length:', base64String.length);

      if (!base64String) {
        throw new Error('レスポンスボディが空です。');
      }

      try {
        // ★★★ Base64 をデコードしてバイナリデータに変換 ★★★
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        console.log('Decoded Uint8Array length:', bytes.length);

        // 3. Uint8Array から Blob を作成
        const blob = new Blob([bytes], { type: 'image/png' });
        console.log('Blob created from decoded data:', blob);

        // ★★★ ダウンロード処理 ★★★
        // レスポンスヘッダーからファイル名を取得 (任意)
        const disposition = response.headers.get('content-disposition');
        let filename = 'downloaded_image.png'; // デフォルトファイル名
        if (disposition && disposition.indexOf('attachment') !== -1) {
          const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
          const matches = filenameRegex.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        // Blob から Object URL を作成
        const url = window.URL.createObjectURL(blob);
        console.log('Object URL for download:', url);

        // ダウンロード用リンクを作成してクリック
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();

        // リソース解放を遅延させる
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log('Download link removed and Object URL revoked.');
        }, 100);

        responseMessage.textContent = `ファイル '${filename}' のダウンロードを開始しました。`;
        responseMessage.style.color = 'green';

        // 画像表示処理はコメントアウトまたは削除
        const imgElement = document.getElementById('resultImage');
        if (imgElement) {
          if (imgElement.src && imgElement.src.startsWith('blob:')) {
            window.URL.revokeObjectURL(imgElement.src);
          }
          const objectURL = window.URL.createObjectURL(blob);
          imgElement.src = objectURL;
        }
      } catch (e) {
        console.error('Base64 decode or download processing error:', e);
        throw new Error(
          'Base64 デコードまたはダウンロード処理中にエラーが発生しました。'
        );
      }
    } catch (error) {
      responseMessage.textContent = 'エラーが発生しました: ' + error.message;
      responseMessage.style.color = 'red';
      // エラー時も古い Object URL を解放
      const imgElement = document.getElementById('resultImage');
      if (imgElement && imgElement.src && imgElement.src.startsWith('blob:')) {
        window.URL.revokeObjectURL(imgElement.src);
      }
    }
  });
});

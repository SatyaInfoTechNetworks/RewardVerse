import https from 'https';

/**
 * Sends a notification to the admin's Telegram via bot.
 * @param {string} message The HTML message to send
 * @returns {Promise<boolean>}
 */
export async function sendAdminTelegramAlert(message) {
  const botToken = process.env.ADMIN_TELEGRAM_BOT_TOKEN || '8441190461:AAErfv2dgLp7DiWuo85RmnFL7AS3HwHu1W0';
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID || '1981634693';

  if (!botToken || !chatId) {
    console.warn('[AdminTelegram] Bot token or Chat ID is missing.');
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const postData = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  });

  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            console.error(`[AdminTelegram] Failed to send. HTTP: ${res.statusCode}. Resp: ${body}`);
            resolve(false);
          }
        });
      }
    );

    req.on('error', (err) => {
      console.error('[AdminTelegram] Network Error:', err.message);
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      console.error('[AdminTelegram] Request timed out.');
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

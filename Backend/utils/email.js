import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends an email containing the redeem voucher code to the user.
 * Falls back to warning logging if SMTP variables are not set.
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} userName - Name of the user
 * @param {string} method - Payout method name (e.g. Google Play)
 * @param {string} redeemCode - The voucher/redeem code
 * @param {string|number} monetaryValue - Value of the redeem request
 * @returns {Promise<boolean>} Resolves to true if sent, false otherwise
 */
export async function sendRedeemCodeEmail(toEmail, userName, method, redeemCode, monetaryValue) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"Rewardverse" <${smtpUser}>`;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('⚠️ SMTP settings are not fully configured in environment variables. Email could not be sent.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const mailOptions = {
    from: smtpFrom,
    to: toEmail,
    subject: `🎁 Your ${method} Redeem Code - Rewardverse`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff; color: #333333;">
        <div style="text-align: center; border-bottom: 2px solid #3f51b5; padding-bottom: 20px; margin-bottom: 25px;">
          <h2 style="color: #3f51b5; margin: 0;">Rewardverse</h2>
          <span style="font-size: 12px; color: #777777;">Your Earning Partner</span>
        </div>
        
        <p>Dear <strong>${userName || 'Valued User'}</strong>,</p>
        
        <p>Congratulations! Your request for withdrawal via <strong>${method}</strong> has been successfully approved.</p>
        
        <div style="background-color: #f5f5f5; border-left: 4px solid #3f51b5; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #555555;"><strong>Redemption Details:</strong></p>
          <p style="margin: 0 0 5px 0;"><strong>Method:</strong> ${method}</p>
          <p style="margin: 0 0 5px 0;"><strong>Monetary Value:</strong> ₹${monetaryValue}</p>
          <p style="margin: 0;"><strong>Status:</strong> Completed</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <p style="margin-bottom: 10px; font-size: 14px; color: #666666;">Here is your redeem code:</p>
          <div style="display: inline-block; font-size: 24px; font-weight: bold; letter-spacing: 1px; color: #e91e63; background-color: #fce4ec; border: 2px dashed #e91e63; padding: 15px 30px; border-radius: 8px; font-family: monospace;">
            ${redeemCode}
          </div>
        </div>

        <p>Please copy this code and redeem it on the respective platform (Google Play Store, Amazon Pay, etc.).</p>
        
        <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 30px 0;" />
        
        <p style="font-size: 12px; color: #777777; line-height: 1.5; text-align: center;">
          This is an automated email. Please do not reply directly to this message. For any support, please open a ticket in the support section of the Rewardverse app.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email successfully sent to ${toEmail}. Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending SMTP email:', error);
    throw error;
  }
}

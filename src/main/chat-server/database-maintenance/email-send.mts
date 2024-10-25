import type { UserEntry } from '../../database/database-interfaces.mjs';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { promises } from 'fs';

dotenv.config();

/**
 * Sends an email notification to the specified user regarding account deletion.
 *
 * @param user - A userEntry object who the mail is send to.
 * @remarks This function utilizes an email template to notify the user about an account deletion notice.
 *           It constructs an email with subject 'Account Deletion Notice' and sends it to the user's email address.
 */
export async function sendMailToUser(user: UserEntry) {
  const sender = process.env['MAIL_ADRESS'];
  const stmpKey = process.env['BREVO_KEY'];
  const emailTemplatePath = 'src/main/chat-server/database-maintenance/email-template.html';

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: sender,
      pass: stmpKey,
    },
  });

  const htmlBody = await promises.readFile(emailTemplatePath, 'utf8');

  const emailContent = htmlBody.replace('USER_NICKNAME', user.user_name);

  const mailOptions = {
    from: sender,
    to: user.email_ID,
    subject: 'Account Deletion Notice',
    html: emailContent,
  };
  await transporter.sendMail(mailOptions);
}

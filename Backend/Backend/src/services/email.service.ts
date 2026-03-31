/**
 * Email Service
 * 
 * Handles sending emails for parental consent and other notifications
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ParentalConsentEmailData {
  parentEmail: string;
  childUsername: string;
  childEmail: string;
  token: string;
  expiresAt: Date;
}

// ============================================================================
// Send Parental Consent Email
// ============================================================================

export async function sendParentalConsentEmail(data: ParentalConsentEmailData): Promise<void> {
  try {
    const { parentEmail, childUsername, childEmail, token, expiresAt } = data;

    // Generate confirmation URL
    const baseUrl = process.env.API_URL || 'http://localhost:3000';
    const confirmUrl = `${baseUrl}/api/auth/confirm-parental-consent/${token}`;

    // Calculate expiration time
    const hoursUntilExpiry = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Parental Consent Required - 90Plus</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .info-box {
            background: white;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎮 90Plus</h1>
          <p>Parental Consent Required</p>
        </div>
        
        <div class="content">
          <h2>Hello Parent/Guardian,</h2>
          
          <p>Your child has requested to use 90Plus, a football social media app. As they are between 13-17 years old, we require your consent before they can access the app.</p>
          
          <div class="info-box">
            <strong>Child's Information:</strong><br>
            Username: <strong>${childUsername}</strong><br>
            Email: <strong>${childEmail}</strong>
          </div>
          
          <h3>What is 90Plus?</h3>
          <p>90Plus is a football-focused social media platform where users can:</p>
          <ul>
            <li>Share football-related videos and content</li>
            <li>Follow their favorite teams and players</li>
            <li>Participate in quizzes and predictions</li>
            <li>Connect with other football fans</li>
          </ul>
          
          <h3>Safety for Teens (13-17)</h3>
          <p>We take your child's safety seriously. For users aged 13-17, we have implemented the following restrictions:</p>
          <ul>
            <li>❌ No direct messaging or chat features</li>
            <li>❌ No real money transactions</li>
            <li>✅ Moderated content creation</li>
            <li>✅ Limited social interactions</li>
            <li>✅ Private profile by default</li>
            <li>✅ No location sharing</li>
          </ul>
          
          <div class="warning">
            <strong>⏰ Important:</strong> This consent request will expire in <strong>${hoursUntilExpiry} hours</strong>. Please respond before it expires.
          </div>
          
          <center>
            <a href="${confirmUrl}" class="button">✅ Give Consent</a>
          </center>
          
          <p style="text-align: center; color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br>
            <code style="background: #e9ecef; padding: 5px 10px; border-radius: 3px; display: inline-block; margin-top: 10px;">${confirmUrl}</code>
          </p>
          
          <h3>Privacy & Data Protection</h3>
          <p>We comply with COPPA (Children's Online Privacy Protection Act) and GDPR regulations. We collect minimal data from users aged 13-17 and never share personal information with third parties.</p>
          
          <p>For more information, please review our:</p>
          <ul>
            <li><a href="${baseUrl}/privacy-policy.html">Privacy Policy</a></li>
            <li><a href="${baseUrl}/terms-of-service.html">Terms of Service</a></li>
          </ul>
          
          <h3>Questions or Concerns?</h3>
          <p>If you have any questions or concerns about your child using 90Plus, please contact us at:</p>
          <p><strong>Email:</strong> support@90plus.app</p>
          
          <p>Thank you for keeping your child safe online!</p>
          
          <p>Best regards,<br>
          <strong>The 90Plus Team</strong></p>
        </div>
        
        <div class="footer">
          <p>This email was sent to ${parentEmail} because your child (${childUsername}) requested to use 90Plus.</p>
          <p>If you did not expect this email, please ignore it or contact us at support@90plus.app</p>
          <p>&copy; 2026 90Plus. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Email text version (fallback)
    const emailText = `
      90Plus - Parental Consent Required
      
      Hello Parent/Guardian,
      
      Your child has requested to use 90Plus, a football social media app. As they are between 13-17 years old, we require your consent before they can access the app.
      
      Child's Information:
      Username: ${childUsername}
      Email: ${childEmail}
      
      To give consent, please visit:
      ${confirmUrl}
      
      This consent request will expire in ${hoursUntilExpiry} hours.
      
      For more information, visit:
      Privacy Policy: ${baseUrl}/privacy-policy.html
      Terms of Service: ${baseUrl}/terms-of-service.html
      
      Questions? Contact us at support@90plus.app
      
      Thank you for keeping your child safe online!
      
      The 90Plus Team
    `;

    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    // For now, log the email (development only)
    if (process.env.NODE_ENV === 'development') {
      logger.info('📧 Parental Consent Email (DEV MODE):', {
        to: parentEmail,
        subject: 'Parental Consent Required - 90Plus',
        confirmUrl,
        expiresAt,
      });
      
      // In development, also log to console for easy testing
      console.log('\n' + '='.repeat(80));
      console.log('📧 PARENTAL CONSENT EMAIL');
      console.log('='.repeat(80));
      console.log(`To: ${parentEmail}`);
      console.log(`Subject: Parental Consent Required - 90Plus`);
      console.log(`Confirm URL: ${confirmUrl}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('='.repeat(80) + '\n');
    } else {
      // Production: Send actual email
      // TODO: Implement email sending with SendGrid/AWS SES
      logger.info('📧 Sending parental consent email:', {
        to: parentEmail,
        childUsername,
      });
      
      // Example with SendGrid (uncomment when configured):
      /*
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      await sgMail.send({
        to: parentEmail,
        from: 'noreply@90plus.app',
        subject: 'Parental Consent Required - 90Plus',
        text: emailText,
        html: emailHtml,
      });
      */
    }

  } catch (error: any) {
    logger.error('Failed to send parental consent email:', error);
    throw new Error('Failed to send consent email');
  }
}

// ============================================================================
// Send Consent Confirmation Email (to child)
// ============================================================================

export async function sendConsentConfirmationEmail(
  childEmail: string,
  childUsername: string
): Promise<void> {
  try {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Parental Consent Confirmed - 90Plus</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #27ae60; color: white; padding: 30px; text-align: center; border-radius: 10px; }
          .content { padding: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✅ Welcome to 90Plus!</h1>
        </div>
        <div class="content">
          <h2>Hi ${childUsername},</h2>
          <p>Great news! Your parent/guardian has given consent for you to use 90Plus.</p>
          <p>You can now enjoy all the features available for your age group.</p>
          <p>Have fun and stay safe!</p>
          <p>Best regards,<br><strong>The 90Plus Team</strong></p>
        </div>
      </body>
      </html>
    `;

    if (process.env.NODE_ENV === 'development') {
      logger.info('📧 Consent Confirmation Email (DEV MODE):', {
        to: childEmail,
        subject: 'Welcome to 90Plus!',
      });
    } else {
      // TODO: Send actual email
      logger.info('📧 Sending consent confirmation email:', {
        to: childEmail,
        username: childUsername,
      });
    }

  } catch (error: any) {
    logger.error('Failed to send consent confirmation email:', error);
    // Don't throw - this is not critical
  }
}

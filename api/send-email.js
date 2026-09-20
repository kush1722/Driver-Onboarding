import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, name, status, reason } = req.body;

  if (!email || !status) {
    return res.status(400).json({ error: 'Missing email or status' });
  }

  try {
    // Configure the Gmail transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    let subject = '';
    let htmlContent = '';

    // Production URL — update this if the domain ever changes
    const baseUrl = process.env.APP_URL
      || 'https://driver-app-frontend.vercel.app';

    if (status === 'approved') {
      subject = '🎉 You are approved to drive!';
      
      let actionLink = `${baseUrl}/dashboard`;
      try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
          const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
              redirectTo: `${baseUrl}/dashboard`
            }
          });
          if (linkData?.properties?.action_link) {
            actionLink = linkData.properties.action_link;
          }
        }
      } catch (e) {
        console.error("Magic link generation failed:", e);
      }

      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Congratulations, ${name || 'Driver'}!</h2>
          <p>Your application has been reviewed and <strong>approved</strong>.</p>
          <p>You can now log in to the driver portal and start accepting rides!</p>
          <a href="${actionLink}" style="display: inline-block; padding: 10px 20px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">Go to Dashboard</a>
        </div>
      `;
    } else if (status === 'rejected') {
      subject = 'Action Required: Your Application Needs Updates';
      htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello, ${name || 'Driver'}</h2>
          <p>We reviewed your application, but unfortunately, we cannot approve it at this time.</p>
          <p><strong>Reason:</strong> ${reason || 'Please review your uploaded documents.'}</p>
          <p>Please log in to your account and submit a new application with the corrected information.</p>
        </div>
      `;
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const info = await transporter.sendMail({
      from: `"Onboarding Team" <${process.env.GMAIL_USER}>`,
      to: email, // Directly send to the driver's real/dummy email
      subject: subject,
      html: htmlContent
    });

    console.log("Email sent successfully:", info.messageId);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error("Nodemailer Error:", err);
    return res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
}

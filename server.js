const express = require('express');
const { Resend } = require('resend');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

// Rate limiting
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many email requests, please try again later.'
});

// Validation middleware
const validateEmail = (req, res, next) => {
  const { to, subject } = req.body;
  
  if (!to || !subject) {
    return res.status(400).json({
      error: 'Missing required fields: to and subject are required'
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = Array.isArray(to) ? to : [to];
  
  for (const email of emails) {
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: `Invalid email address: ${email}`
      });
    }
  }
  
  next();
};

// Email templates
const templates = {
  welcome: (name) => ({
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Welcome ${name}!</h1>
        <p>Thank you for joining our platform. We're excited to have you on board.</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Getting Started:</h3>
          <ul>
            <li>Complete your profile</li>
            <li>Explore our features</li>
            <li>Connect with other users</li>
          </ul>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The Team</p>
      </div>
    `,
    text: `Welcome ${name}! Thank you for joining our platform. We're excited to have you on board.`
  }),
  
  passwordReset: (resetLink) => ({
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Password Reset Request</h1>
        <p>You requested a password reset for your account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #007cba; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this reset, please ignore this email.</p>
      </div>
    `,
    text: `Password reset requested. Click this link to reset: ${resetLink}`
  }),
  
  notification: (title, message) => ({
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${title}</h2>
        <p>${message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated notification from our system.</p>
      </div>
    `,
    text: `${title}\n\n${message}`
  })
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Send simple email
app.post('/send-email', emailLimiter, validateEmail, async (req, res) => {
  try {
    const { to, subject, html, text, from } = req.body;
    
    const emailData = {
      from: from || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || `<p>${text}</p>`,
      text: text || subject
    };
    
    const result = await resend.emails.send(emailData);
    
    res.json({
      success: true,
      messageId: result.data.id,
      message: 'Email sent successfully'
    });
    
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// Send welcome email
app.post('/send-welcome', emailLimiter, async (req, res) => {
  try {
    const { to, name, from } = req.body;
    
    if (!to || !name) {
      return res.status(400).json({
        error: 'Missing required fields: to and name are required'
      });
    }
    
    const template = templates.welcome(name);
    
    const emailData = {
      from: from || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      to,
      subject: `Welcome to our platform, ${name}!`,
      html: template.html,
      text: template.text
    };
    
    const result = await resend.emails.send(emailData);
    
    res.json({
      success: true,
      messageId: result.data.id,
      message: 'Welcome email sent successfully'
    });
    
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({
      error: 'Failed to send welcome email',
      details: error.message
    });
  }
});

// Send password reset email
app.post('/send-password-reset', emailLimiter, async (req, res) => {
  try {
    const { to, resetLink, from } = req.body;
    
    if (!to || !resetLink) {
      return res.status(400).json({
        error: 'Missing required fields: to and resetLink are required'
      });
    }
    
    const template = templates.passwordReset(resetLink);
    
    const emailData = {
      from: from || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      to,
      subject: 'Password Reset Request',
      html: template.html,
      text: template.text
    };
    
    const result = await resend.emails.send(emailData);
    
    res.json({
      success: true,
      messageId: result.data.id,
      message: 'Password reset email sent successfully'
    });
    
  } catch (error) {
    console.error('Password reset email error:', error);
    res.status(500).json({
      error: 'Failed to send password reset email',
      details: error.message
    });
  }
});

// Send notification email
app.post('/send-notification', emailLimiter, validateEmail, async (req, res) => {
  try {
    const { to, title, message, from } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({
        error: 'Missing required fields: title and message are required'
      });
    }
    
    const template = templates.notification(title, message);
    
    const emailData = {
      from: from || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
      to: Array.isArray(to) ? to : [to],
      subject: title,
      html: template.html,
      text: template.text
    };
    
    const result = await resend.emails.send(emailData);
    
    res.json({
      success: true,
      messageId: result.data.id,
      message: 'Notification email sent successfully'
    });
    
  } catch (error) {
    console.error('Notification email error:', error);
    res.status(500).json({
      error: 'Failed to send notification email',
      details: error.message
    });
  }
});

// Send bulk emails
app.post('/send-bulk', emailLimiter, async (req, res) => {
  try {
    const { recipients, subject, html, text, from } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        error: 'Recipients array is required and must not be empty'
      });
    }
    
    if (!subject) {
      return res.status(400).json({
        error: 'Subject is required'
      });
    }
    
    const results = [];
    const errors = [];
    
    for (const recipient of recipients) {
      try {
        const emailData = {
          from: from || process.env.FROM_EMAIL || 'noreply@yourdomain.com',
          to: recipient.email,
          subject: subject.replace('{{name}}', recipient.name || ''),
          html: html ? html.replace('{{name}}', recipient.name || '') : `<p>${text}</p>`,
          text: text ? text.replace('{{name}}', recipient.name || '') : subject
        };
        
        const result = await resend.emails.send(emailData);
        results.push({
          email: recipient.email,
          messageId: result.data.id,
          success: true
        });
        
      } catch (error) {
        errors.push({
          email: recipient.email,
          error: error.message,
          success: false
        });
      }
    }
    
    res.json({
      success: errors.length === 0,
      totalSent: results.length,
      totalFailed: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('Bulk email error:', error);
    res.status(500).json({
      error: 'Failed to send bulk emails',
      details: error.message
    });
  }
});

// Get email templates
app.get('/templates', (req, res) => {
  res.json({
    available: ['welcome', 'passwordReset', 'notification'],
    description: 'Use these template names with the corresponding endpoints'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong on our end'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /send-email',
      'POST /send-welcome',
      'POST /send-password-reset',
      'POST /send-notification',
      'POST /send-bulk',
      'GET /templates',
      'GET /health'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Resend email backend running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('- POST /send-email');
  console.log('- POST /send-welcome');
  console.log('- POST /send-password-reset');
  console.log('- POST /send-notification');
  console.log('- POST /send-bulk');
  console.log('- GET /templates');
  console.log('- GET /health');
});

module.exports = app;
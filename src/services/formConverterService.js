const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class FormConverterService {
  constructor() {
    this.formsDir = path.join(__dirname, '../../forms_output');
    this.ensureFormsDir();
    
    // Theme configurations
    this.themes = {
      purple: {
        header: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        accent: '#667eea',
        accentDark: '#764ba2',
        button: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: 'from-slate-900 via-purple-900 to-slate-900',
        iconColor: '#667eea'
      },
      blue: {
        header: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
        accent: '#3b82f6',
        accentDark: '#1e40af',
        button: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
        background: 'from-slate-50 via-blue-50 to-slate-50',
        iconColor: '#3b82f6'
      },
      green: {
        header: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        accent: '#10b981',
        accentDark: '#059669',
        button: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        background: 'from-slate-900 via-green-900 to-slate-900',
        iconColor: '#10b981'
      },
      pink: {
        header: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        accent: '#ec4899',
        accentDark: '#be185d',
        button: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        background: 'from-slate-900 via-pink-900 to-slate-900',
        iconColor: '#ec4899'
      },
      orange: {
        header: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
        accent: '#f97316',
        accentDark: '#c2410c',
        button: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)',
        background: 'from-slate-900 via-orange-900 to-slate-900',
        iconColor: '#f97316'
      }
    };
  }

  async ensureFormsDir() {
    try {
      await fs.mkdir(this.formsDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating forms directory:', error);
    }
  }

  /**
   * Extract form ID from Google Forms URL
   * Supports formats:
   * - https://forms.google.com/d/e/1FAIpQLSd.../viewform
   * - https://forms.google.com/d/1FAIpQLSd.../edit
   * - https://docs.google.com/forms/d/e/1FAIpQLSd.../viewform
   * - https://docs.google.com/forms/d/1FAIpQLSd.../edit
   */
  extractFormId(url) {
    try {
      // Try docs.google.com/forms format first (d/e/ID or d/ID)
      let formIdMatch = url.match(/docs\.google\.com\/forms\/d\/e\/([a-zA-Z0-9\-_]+)/);
      if (formIdMatch) {
        return formIdMatch[1];
      }
      
      // Try docs.google.com/forms without /e/
      formIdMatch = url.match(/docs\.google\.com\/forms\/d\/([a-zA-Z0-9\-_]+)/);
      if (formIdMatch) {
        return formIdMatch[1];
      }
      
      // Try forms.google.com format with /e/
      formIdMatch = url.match(/forms\.google\.com\/d\/e\/([a-zA-Z0-9\-_]+)/);
      if (formIdMatch) {
        return formIdMatch[1];
      }
      
      // Try forms.google.com format without /e/
      formIdMatch = url.match(/forms\.google\.com\/d\/([a-zA-Z0-9\-_]+)/);
      if (formIdMatch) {
        return formIdMatch[1];
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting form ID:', error);
      return null;
    }
  }

  /**
   * Check if URL is a Google Forms link
   * Matches both docs.google.com/forms and forms.google.com formats
   */
  isGoogleFormsLink(url) {
    return /(?:docs\.google\.com\/forms|forms\.google\.com)/.test(url);
  }

  /**
   * Generate HTML form with Tailwind CSS styling
   */
  async generateFormHTML(formId) {
    try {
      const formActionUrl = `https://docs.google.com/forms/d/e/${formId}/formResponse`;
      
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Form</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
            letter-spacing: 0.3px;
        }
        
        .form-container {
            animation: slideUp 0.6s ease-out;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .form-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            position: relative;
            overflow: hidden;
        }
        
        .form-header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 500px;
            height: 500px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
        }
        
        .form-header::after {
            content: '';
            position: absolute;
            bottom: -30%;
            left: -10%;
            width: 350px;
            height: 350px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 50%;
        }
        
        .form-content {
            background: #ffffff;
            border-radius: 0 0 24px 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
        }
        
        .form-fieldset {
            position: relative;
            margin-bottom: 28px;
            animation: fadeIn 0.5s ease-out forwards;
            opacity: 0;
        }
        
        @keyframes fadeIn {
            to {
                opacity: 1;
            }
        }
        
        .form-fieldset:nth-child(1) { animation-delay: 0.1s; }
        .form-fieldset:nth-child(2) { animation-delay: 0.2s; }
        .form-fieldset:nth-child(3) { animation-delay: 0.3s; }
        .form-fieldset:nth-child(4) { animation-delay: 0.4s; }
        .form-fieldset:nth-child(5) { animation-delay: 0.5s; }
        
        .field-icon {
            position: absolute;
            left: 16px;
          top: 50%;
          transform: translateY(-50%);
            color: #667eea;
            font-size: 18px;
            pointer-events: none;
            transition: all 0.3s ease;
            z-index: 10;
        }

        .form-group.textarea-group .field-icon {
          top: 22px;
          transform: none;
        }
        
        .form-fieldset:focus-within .field-icon {
            color: #764ba2;
          transform: translateY(-50%) scale(1.08);
        }

        .form-group.textarea-group:focus-within .field-icon {
          transform: scale(1.08);
        }
        
        .form-fieldset legend {
            display: block;
            font-size: 15px;
            font-weight: 600;
            color: #1a202c;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            font-size: 13px;
            opacity: 0.8;
        }
        
        .required::after {
            content: " *";
            color: #ef4444;
            font-weight: 700;
        }
        
        .form-group {
            position: relative;
        }
        
        input[type="text"],
        input[type="email"],
        input[type="tel"],
        input[type="number"],
        textarea,
        select {
            width: 100%;
            padding: 14px 16px 14px 48px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
            font-size: 15px;
            font-family: inherit;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #1a202c;
        }
        
        input::placeholder,
        textarea::placeholder {
            color: #9ca3af;
            font-weight: 400;
        }
        
        input[type="text"]:hover,
        input[type="email"]:hover,
        input[type="tel"]:hover,
        input[type="number"]:hover,
        textarea:hover,
        select:hover {
            border-color: #d1d5db;
            background: #f3f4f6;
        }
        
        input[type="text"]:focus,
        input[type="email"]:focus,
        input[type="tel"]:focus,
        input[type="number"]:focus,
        textarea:focus,
        select:focus {
            outline: none;
            border-color: #667eea;
            background: #ffffff;
            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
            transform: translateY(-2px);
        }
        
        textarea {
            resize: vertical;
            min-height: 140px;
            font-family: inherit;
        }
        
        .form-control {
            width: 100%;
            padding: 14px 16px 14px 48px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
            font-size: 15px;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .btn-submit {
            width: 100%;
            padding: 16px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-weight: 600;
            font-size: 16px;
            border: none;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
            margin-top: 16px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        
        .btn-submit:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(102, 126, 234, 0.4);
        }
        
        .btn-submit:active {
            transform: translateY(-1px);
        }
        
        .form-footer {
            text-align: center;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
        }
        
        .form-footer-text {
            font-size: 13px;
            color: #6b7280;
            letter-spacing: 0.3px;
        }
        
        .form-footer-link {
            display: inline-block;
            margin-top: 10px;
        }
        
        .form-footer-link a {
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            font-size: 13px;
        }
        
        .form-footer-link a:hover {
            color: #764ba2;
            letter-spacing: 1px;
        }
        
        .success-message {
            display: none;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 20px;
            animation: slideUp 0.5s ease-out;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 min-h-screen py-8 px-4">
    <div class="max-w-2xl mx-auto form-container">
        <!-- Header Card -->
        <div class="form-header rounded-t-2xl p-12 text-white relative">
            <h1 class="text-4xl font-bold mb-3 relative z-20">Contact Information</h1>
            <p class="text-blue-100 text-base relative z-20 font-light">Get in touch with us today. We'd love to hear from you!</p>
        </div>

        <!-- Form Card -->
        <form 
            action="${formActionUrl}"
            method="POST"
            class="form-content p-10">

            <div class="success-message" id="successMessage">
                ✅ Thank you! Your message has been sent successfully.
            </div>

            <!-- Name Field -->
            <fieldset class="form-fieldset">
                <legend class="required">Full Name</legend>
                <div class="form-group">
                    <i class="fas fa-user field-icon"></i>
                    <input 
                        id="name"
                        type="text" 
                        name="entry.2005620554" 
                        class="form-control" 
                        placeholder="John Doe"
                        required>
                </div>
            </fieldset>

            <!-- Email Field -->
            <fieldset class="form-fieldset">
                <legend class="required">Email Address</legend>
                <div class="form-group">
                    <i class="fas fa-envelope field-icon"></i>
                    <input 
                        id="email"
                        type="email" 
                        name="entry.1045781291" 
                        class="form-control" 
                        placeholder="john@example.com"
                        required>
                </div>
            </fieldset>

            <!-- Address Field -->
            <fieldset class="form-fieldset">
                <legend class="required">Street Address</legend>
                <div class="form-group textarea-group">
                    <i class="fas fa-map-marker-alt field-icon"></i>
                    <textarea 
                        id="address"
                        name="entry.1065046570" 
                        class="form-control" 
                        placeholder="123 Main Street, Suite 100, City, State 12345"
                        required></textarea>
                </div>
            </fieldset>

            <!-- Phone Field -->
            <fieldset class="form-fieldset">
                <legend>Phone Number</legend>
                <div class="form-group">
                    <i class="fas fa-phone field-icon"></i>
                    <input 
                        id="phone"
                        type="tel" 
                        name="entry.1166974658" 
                        class="form-control" 
                        placeholder="(555) 123-4567">
                </div>
            </fieldset>

            <!-- Comments Field -->
            <fieldset class="form-fieldset">
                <legend>Message</legend>
                <div class="form-group textarea-group">
                    <i class="fas fa-comment-dots field-icon"></i>
                    <textarea 
                        id="comments"
                        name="entry.839337160" 
                        class="form-control" 
                        placeholder="Tell us how we can help..."></textarea>
                </div>
            </fieldset>

            <!-- Hidden Fields -->
            <input type="hidden" name="fvv" value="1">
            <input type="hidden" name="fbzx" value="8861785682619486580">
            <input type="hidden" name="pageHistory" value="0">

            <!-- Submit Button -->
            <button type="submit" class="btn-submit">
                <span>Send Message</span>
            </button>

            <!-- Info Text -->
            <div class="form-footer">
                <p class="form-footer-text">📤 Generated on ${date}</p>
                <div class="form-footer-link">
                    <a href="https://docs.google.com/forms/d/e/${formId}/viewform" target="_blank">
                        View original form →
                    </a>
                </div>
            </div>
        </form>

        <!-- Footer -->
        <div class="mt-8 text-center">
            <p class="text-slate-400 text-sm">🤖 Powered by Telegram Bot Form Converter</p>
        </div>
    </div>

    <script>
        document.querySelector('form').addEventListener('submit', function(e) {
            // Let the form submit normally to Google
            console.log('Form submitted');
        });
    </script>
</body>
</html>`;
    } catch (error) {
      logger.error('Error generating form HTML:', error);
      throw error;
    }
  }

  /**
   * Save HTML to file and return filename
   */
  async saveFormHtml(html, formId) {
    try {
      const timestamp = Date.now();
      const filename = `form_${formId.replace(/[^a-zA-Z0-9-]/g, '')}_${timestamp}.html`;
      const filepath = path.join(this.formsDir, filename);

      await fs.writeFile(filepath, html, 'utf-8');
      logger.info(`Form HTML saved: ${filename}`);

      return filename;
    } catch (error) {
      logger.error('Error saving form HTML:', error);
      throw error;
    }
  }

  /**
   * Main method: Convert and save Google Form
   */
  async processGoogleFormLink(url) {
    try {
      const formId = this.extractFormId(url);
      if (!formId) {
        throw new Error('Could not extract form ID from URL');
      }

      const html = await this.generateFormHTML(formId);
      const filename = await this.saveFormHtml(html, formId);

      const port = process.env.HTTP_PORT || 3000;
      const host = process.env.HTTP_HOST || 'localhost';
      const viewUrl = `http://${host}:${port}/${filename}`;

      return {
        success: true,
        formId,
        filename,
        viewUrl,
        originalUrl: url
      };
    } catch (error) {
      logger.error('Error processing Google Form link:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FormConverterService;

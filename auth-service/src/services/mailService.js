import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cria o transporte SMTP do Nodemailer com base nas variáveis de ambiente.
 * Suporta Mailtrap (desenvolvimento) e Brevo (produção).
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '2525', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true para 465, false para 2525 / 587
    auth: {
      user,
      pass
    }
  });
}

/**
 * Envia o e-mail com o link de recuperação de senha com validade de 30 minutos.
 *
 * @param {string} toEmail - E-mail do destinatário
 * @param {string} toName - Nome do destinatário
 * @param {string} resetUrl - URL completa para redefinição de senha
 * @param {string} token - Token gerado
 */
export async function sendPasswordResetEmail(toEmail, toName, resetUrl, token) {
  const from = process.env.SMTP_FROM || 'Catálogo de Filmes <nao-responda@catalogofilmes.com>';
  const transporter = createTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0d0f12;
          color: #f3f4f6;
          margin: 0;
          padding: 24px;
        }
        .container {
          max-width: 580px;
          margin: 0 auto;
          background: #161a22;
          border: 1px solid #2a313d;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        }
        .header {
          background: linear-gradient(135deg, #1f242e 0%, #11141a 100%);
          padding: 28px 24px;
          text-align: center;
          border-bottom: 2px solid #e5a93c;
        }
        .brand-title {
          color: #e5a93c;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: 1px;
          margin: 0;
        }
        .brand-sub {
          color: #9ca3af;
          font-size: 13px;
          margin-top: 4px;
        }
        .content {
          padding: 32px 28px;
          line-height: 1.6;
        }
        h2 {
          color: #ffffff;
          font-size: 20px;
          margin-top: 0;
        }
        p {
          color: #cbd5e1;
          font-size: 15px;
        }
        .btn-wrapper {
          text-align: center;
          margin: 32px 0;
        }
        .btn-reset {
          background: #e5a93c;
          color: #0d0f12 !important;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 16px;
          display: inline-block;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 14px rgba(229, 169, 60, 0.4);
        }
        .alert-box {
          background: rgba(229, 169, 60, 0.1);
          border-left: 4px solid #e5a93c;
          padding: 14px 16px;
          border-radius: 4px;
          margin: 24px 0;
          font-size: 14px;
          color: #e2e8f0;
        }
        .token-box {
          background: #0d0f12;
          border: 1px dashed #374151;
          padding: 12px;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          color: #93c5fd;
          word-break: break-all;
          margin-top: 10px;
        }
        .footer {
          background: #0e1117;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          border-top: 1px solid #242b35;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="brand-title">🎬 CATÁLOGO DE FILMES</div>
          <div class="brand-sub">Serviço de Autenticação e Segurança</div>
        </div>
        <div class="content">
          <h2>Olá, ${toName || 'Usuário'}!</h2>
          <p>Recebemos uma solicitação para redefinir a senha de acesso à sua conta.</p>
          <p>Para prosseguir e cadastrar uma nova senha, clique no botão abaixo:</p>
          
          <div class="btn-wrapper">
            <a href="${resetUrl}" class="btn-reset" target="_blank">Redefinir Minha Senha</a>
          </div>

          <div class="alert-box">
            ⏱️ <strong>Atenção à validade:</strong> Este link expira em <strong>30 minutos</strong> e só pode ser utilizado <strong>uma única vez</strong>.
          </div>

          <p style="font-size: 13px; color: #94a3b8;">
            Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:
          </p>
          <div class="token-box">
            ${resetUrl}
          </div>

          <p style="font-size: 13px; color: #94a3b8; margin-top: 24px;">
            Se você não solicitou a troca de senha, pode ignorar este e-mail com segurança. Sua senha atual permanecerá inalterada.
          </p>
        </div>
        <div class="footer">
          Catálogo de Filmes Tom Hanks · ISW055 Computação em Nuvem<br>
          Este é um e-mail transacional gerado automaticamente.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Olá, ${toName || 'Usuário'}!

Recebemos uma solicitação para redefinir a senha da sua conta no Catálogo de Filmes.

Acesse o link abaixo para cadastrar sua nova senha:
${resetUrl}

Atenção: Este link expira em 30 minutos e só pode ser utilizado uma única vez.

Se você não solicitou esta alteração, ignore esta mensagem.
  `.trim();

  // Se o servidor SMTP estiver configurado, envia de fato
  if (transporter) {
    try {
      console.log(`[MailService] Enviando e-mail de recuperação via SMTP (${process.env.SMTP_HOST}) para: ${toEmail}`);
      const info = await transporter.sendMail({
        from,
        to: toEmail,
        subject: 'Redefinição de Senha — Catálogo de Filmes',
        text: textContent,
        html: htmlContent
      });
      console.log(`[MailService] E-mail enviado com sucesso! MessageID: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: 'smtp' };
    } catch (err) {
      console.error('[MailService] Erro ao enviar e-mail via SMTP:', err.message);
      throw new Error(`Falha no envio de e-mail: ${err.message}`);
    }
  } else {
    // Modo simulação caso SMTP ainda não tenha sido configurado no .env
    console.log('================================================================');
    console.log('⚠️ [MailService] SMTP_HOST não configurado. E-mail simulado em console:');
    console.log(`✉️ Para: ${toEmail}`);
    console.log(`🔗 Link de Redefinição (Válido por 30 min): ${resetUrl}`);
    console.log(`🔑 Token: ${token}`);
    console.log('================================================================');
    return { success: true, mode: 'mock_console', resetUrl };
  }
}

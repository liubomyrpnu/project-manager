import fs from 'node:fs/promises';
import path from 'node:path';

// Надсилання листів. Транспорти:
//  - smtp    — справжня пошта через nodemailer (Gmail, Mailtrap, Ukr.net …);
//  - console — лист виводиться в консоль сервера і зберігається у папку mail-outbox
//              (зручно, якщо SMTP ще не налаштовано);
//  - memory  — листи складаються в масив (для автоматичних тестів).

function consoleTransport(outboxDir) {
  return {
    async send(message) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safeTo = message.to.replace(/[^\w.@-]/g, '_');
      await fs.mkdir(outboxDir, { recursive: true });
      const file = path.join(outboxDir, `${stamp}_${safeTo}.html`);
      await fs.writeFile(file, `<!-- To: ${message.to} | Subject: ${message.subject} -->\n${message.html}`, 'utf8');
      console.log(`\n[mail] Лист для ${message.to}: «${message.subject}»\n${message.text}\n[mail] Збережено: ${file}\n`);
    },
  };
}

async function smtpTransport({ smtp, from }) {
  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return { send: (message) => transporter.sendMail({ from, ...message }) };
}

export function memoryTransport() {
  const sent = [];
  return { sent, send: async (message) => { sent.push(message); } };
}

export async function createMailService(mailConfig, transport) {
  let selected = transport;
  if (!selected) {
    selected = mailConfig.transport === 'smtp' ? await smtpTransport(mailConfig) : consoleTransport(mailConfig.outboxDir);
  }
  return {
    transport: selected,
    send: ({ to, subject, html, text }) => selected.send({ to, subject, html, text }),
  };
}

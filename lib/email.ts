// lib/email.ts
import nodemailer, { Transporter } from 'nodemailer'

const transporter: Transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export interface MailOptions {
  to:      string | string[]
  subject: string
  html:    string
  text?:   string
}

export interface PhaseEmailPayload {
  toEmail:         string | string[]
  toName?:         string
  requestCode:     string
  sampleName:      string
  newPhase:        string
  expectedByDate?: string
  labName?:        string
  notes?:          string
}

export async function sendEmail(opts: MailOptions): Promise<void> {
  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  })
}

export async function sendPhaseEmail(payload: PhaseEmailPayload): Promise<void> {
  const phaseLabel = payload.newPhase.replace(/_/g, ' ')

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#1d4ed8">Request Phase Update</h2>
      <p>Hi ${payload.toName ?? 'Researcher'},</p>
      <p>
        Request <strong>${payload.requestCode}</strong>
        ${payload.sampleName ? `(${payload.sampleName})` : ''}
        has moved to the <strong>${phaseLabel}</strong> phase.
      </p>
      ${payload.expectedByDate ? `<p>Expected by: <strong>${payload.expectedByDate}</strong></p>` : ''}
      ${payload.labName        ? `<p>Lab: <strong>${payload.labName}</strong></p>`               : ''}
      ${payload.notes          ? `<p>Notes: ${payload.notes}</p>`                                : ''}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="font-size:12px;color:#6b7280">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
  `

  await sendEmail({
    to:      payload.toEmail,
    subject: `Phase Update — ${payload.requestCode}: ${phaseLabel}`,
    html,
    text: `Request ${payload.requestCode} has moved to the ${phaseLabel} phase.${
      payload.notes ? ` Notes: ${payload.notes}` : ''
    }`,
  })
}
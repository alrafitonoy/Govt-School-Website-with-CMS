export const EMAIL_TEMPLATES = [
  {
    key: 'account_activation',
    name: 'Account activation',
    subject: 'Activate your {{school_name}} account',
    body: `<p>Hello {{name}},</p>
<p>An account has been created for you on the {{school_name}} website. Please verify this email address and choose a password.</p>
<p><a class="btn" href="{{link}}">Verify email and set password</a></p>
<p>This link expires in 72 hours. If you did not expect this email, you can ignore it.</p>`,
  },
  {
    key: 'password_reset',
    name: 'Password reset',
    subject: 'Reset your {{school_name}} password',
    body: `<p>Hello {{name}},</p>
<p>We received a request to reset your password.</p>
<p><a class="btn" href="{{link}}">Choose a new password</a></p>
<p>This link expires in 1 hour. If you did not ask for this, you can ignore this email and your password stays the same.</p>`,
  },
  {
    key: 'admission_received',
    name: 'Admission application received',
    subject: 'Application {{app_no}} received',
    body: `<p>Dear Guardian,</p>
<p>We have received the admission application for <strong>{{student_name}}</strong>.</p>
<p>Application number: <strong>{{app_no}}</strong><br>Fee: {{fee}}</p>
<p>You can check the status at any time using the application number and mobile number:</p>
<p><a class="btn" href="{{link}}">Check application status</a></p>`,
  },
  {
    key: 'payment_confirmed',
    name: 'Payment confirmed',
    subject: 'Payment received for application {{app_no}}',
    body: `<p>Dear Guardian,</p>
<p>We have received your payment for application <strong>{{app_no}}</strong> ({{student_name}}).</p>
<p>Amount: <strong>{{amount}}</strong><br>Reference: {{ref}}</p>
<p>Please keep this email as your receipt.</p>`,
  },
  {
    key: 'general_announcement',
    name: 'General announcement',
    subject: 'A message from {{school_name}}',
    body: `<p>Dear {{name}},</p>
<p>Write your message here.</p>
<p>Regards,<br>{{school_name}}</p>`,
  },
];

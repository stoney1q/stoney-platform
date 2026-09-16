import { Resend } from 'resend';
import { prisma } from '../prisma';

let resendClient: Resend | null = null;
const getResend = () => {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY || 're_dummy');
  }
  return resendClient;
};

export async function sendDocumentEmail(
  documentId: string,
  email: string,
  type: 'SALE' | 'QUOTATION' | 'REPAIR',
  signedUrl: string
) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  // Fetch the basic document details to build the email
  let documentNumber = '';
  let branchId = '';
  let portalToken = '';

  if (type === 'SALE') {
    const doc = await prisma.sale.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('Document not found');
    documentNumber = doc.documentNumber || doc.id;
    branchId = doc.branchId;
    // Sales don't use portalToken currently
  } else if (type === 'QUOTATION') {
    const doc = await prisma.quotation.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new Error('Document not found');
    documentNumber = doc.documentNumber || doc.id;
    branchId = doc.branchId;
    portalToken = doc.portalToken;
  } else if (type === 'REPAIR') {
    const doc = await prisma.repair.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('Document not found');
    documentNumber = doc.documentNumber || doc.id;
    branchId = doc.branchId;
    portalToken = doc.portalToken;
  }

  // Fetch branch details
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });

  // Format the type for display
  const displayType = type.charAt(0) + type.slice(1).toLowerCase(); // 'Sale', 'Quotation', 'Repair'

  const fromEmail = `noreply@${process.env.RESEND_DOMAIN || 'stoney-platform.com'}`; // Standard configuration

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Your ${displayType} Document from ${branch?.name || 'Stoney Platform'}</h2>
      <p>Hello,</p>
      <p>Please find attached the document <strong>${documentNumber}</strong> for your recent transaction.</p>
      <div style="margin: 30px 0; display: flex; gap: 10px;">
        <a href="${signedUrl}" style="background-color: #f3f4f6; color: #111827; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; border: 1px solid #d1d5db;">
          Download PDF
        </a>
        ${
          portalToken
            ? `
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/portal/${portalToken}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          View & Track Online
        </a>
        `
            : ''
        }
      </div>
      <p style="color: #666; font-size: 14px;">
        The PDF link is secure and will expire in 7 days.<br>
        If you have any questions, please contact us at ${branch?.email || 'support'}.
      </p>
      <hr style="border: none; border-top: 1px solid #eaeaea; margin-top: 40px;" />
      <p style="color: #999; font-size: 12px; text-align: center;">
        ${branch?.name || 'Stoney Platform'} &copy; ${new Date().getFullYear()}
      </p>
    </div>
  `;

  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: `${branch?.name || 'Stoney Platform'} <${fromEmail}>`,
    to: [email],
    subject: `Your ${displayType} Document: ${documentNumber}`,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

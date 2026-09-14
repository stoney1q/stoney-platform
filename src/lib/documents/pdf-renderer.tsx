import 'server-only';
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { DocumentSnapshotData } from '@/components/documents/ReceiptTemplate';
import { storage } from '@/lib/media/storage';
import { Prisma } from '@/generated/prisma/client';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    margin: 10,
    padding: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 5,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    paddingVertical: 5,
    fontWeight: 'bold',
  },
  colText: {
    fontSize: 10,
  },
  colRight: {
    fontSize: 10,
    textAlign: 'right',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalsContainer: {
    marginTop: 20,
    width: '50%',
    alignSelf: 'flex-end',
  },
  boldText: {
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#888',
  },
});

type PdfDocumentProps = {
  type: string;
  documentNumber: string | null;
  date: Date;
  snapshotData: DocumentSnapshotData;
  customer?: { firstName: string; lastName: string } | null;
  items: {
    productName: string;
    quantity: number;
    total: Prisma.Decimal | number;
  }[];
  totals: {
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
  };
};

const A4Document = ({
  type,
  documentNumber,
  date,
  snapshotData,
  customer,
  items,
  totals,
}: PdfDocumentProps) => {
  const { branch, settings } = snapshotData;
  const curr = settings.currencySymbol || '$';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{branch.name}</Text>
          <Text style={styles.subtitle}>
            {branch.address} | {branch.phone}
          </Text>
          {settings.taxRegistration && (
            <Text style={styles.subtitle}>
              Tax ID: {settings.taxRegistration}
            </Text>
          )}
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
            {type} {documentNumber || 'PENDING'}
          </Text>
          <Text style={{ fontSize: 10, marginTop: 4 }}>
            Date: {date.toLocaleDateString()}
          </Text>
          {customer && (
            <Text style={{ fontSize: 10, marginTop: 4 }}>
              Bill To: {customer.firstName} {customer.lastName}
            </Text>
          )}
        </View>

        <View>
          <View style={styles.rowHeader}>
            <Text style={[styles.colText, { width: '50%' }]}>Item</Text>
            <Text style={[styles.colRight, { width: '15%' }]}>Qty</Text>
            <Text style={[styles.colRight, { width: '35%' }]}>Total</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.colText, { width: '50%' }]}>
                {item.productName}
              </Text>
              <Text style={[styles.colRight, { width: '15%' }]}>
                {item.quantity}
              </Text>
              <Text style={[styles.colRight, { width: '35%' }]}>
                {curr}
                {Number(item.total).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsContainer}>
          <View style={styles.totalsRow}>
            <Text style={styles.colText}>Subtotal:</Text>
            <Text style={styles.colRight}>
              {curr}
              {Number(totals.subtotal).toFixed(2)}
            </Text>
          </View>
          {Number(totals.discount) > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.colText}>Discount:</Text>
              <Text style={styles.colRight}>
                -{curr}
                {Number(totals.discount).toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.totalsRow}>
            <Text style={styles.colText}>Tax:</Text>
            <Text style={styles.colRight}>
              {curr}
              {Number(totals.taxAmount).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.totalsRow, { marginTop: 5 }]}>
            <Text style={[styles.colText, styles.boldText, { fontSize: 12 }]}>
              Total:
            </Text>
            <Text style={[styles.colRight, styles.boldText, { fontSize: 12 }]}>
              {curr}
              {Number(totals.total).toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          {settings.receiptFooter || 'Thank you for your business!'}
        </Text>
      </Page>
    </Document>
  );
};

export async function generateAndStorePdf(
  documentId: string,
  type: 'SALE' | 'QUOTATION' | 'REPAIR',
  props: PdfDocumentProps
): Promise<string> {
  // Generate PDF buffer
  const buffer = await renderToBuffer(<A4Document {...props} />);

  // Define unique path for the document
  const path = `documents/${type.toLowerCase()}s/${documentId}/${props.documentNumber || 'pending'}.pdf`;

  // Upload to GCS via our MediaStorage abstraction
  await storage.saveBuffer(path, buffer, 'application/pdf');

  return path;
}

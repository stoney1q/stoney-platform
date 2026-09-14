'use client';

import React from 'react';

/**
 * A wrapper component for thermal printing (e.g. 80mm POS printers).
 * In normal screen view, it hides itself or shows a preview if configured.
 * In print view, it sizes to 80mm width with standard receipt typography.
 */
export function ThermalPrintWrapper({
  children,
  preview = false,
}: {
  children: React.ReactNode;
  preview?: boolean;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            margin: 0;
            size: 80mm auto; /* Standard thermal width */
          }
          body * {
            visibility: hidden;
          }
          #thermal-print-section, #thermal-print-section * {
            visibility: visible;
          }
          #thermal-print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 2mm;
            font-family: monospace; /* Thermal printers do best with monospaced/simple fonts */
            font-size: 12px;
            color: #000;
            background: #fff;
          }
          /* Hide non-printable elements inside receipt */
          .no-print {
            display: none !important;
          }
        }
        `,
        }}
      />
      <div
        id="thermal-print-section"
        className={`mx-auto w-full max-w-[80mm] bg-white p-4 font-mono text-sm text-black ${preview ? 'block border border-gray-300 shadow-sm' : 'hidden print:block'}`}
      >
        {children}
      </div>
    </>
  );
}

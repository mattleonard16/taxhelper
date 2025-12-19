/**
 * ZIP creation utilities for tax season export
 * Creates a downloadable ZIP with CSV and organized receipts
 */

import JSZip from 'jszip';

interface OrganizedReceipt {
    path: string;
    filename: string;
    exportPath: string;
    content?: Buffer;
}

type OrganizedReceipts = Record<string, OrganizedReceipt[]>;

interface CreateZipOptions {
    csv: string;
    organizedReceipts: OrganizedReceipts;
    year: number;
}

/**
 * Generates the filename for the tax season export ZIP
 */
export function generateZipFilename(year: number): string {
    return `TaxHelper-${year}-Export.zip`;
}

/**
 * Creates a ZIP buffer containing the CSV and organized receipts
 */
export async function createTaxSeasonZip(options: CreateZipOptions): Promise<Buffer> {
    const { csv, organizedReceipts, year } = options;

    const zip = new JSZip();

    // Add CSV file
    const csvFilename = `${year}-tax-summary.csv`;
    zip.file(csvFilename, csv);

    // Add receipt folders and files
    for (const [category, receipts] of Object.entries(organizedReceipts)) {
        // Create folder structure: receipts/CATEGORY/
        const folderPath = `receipts/${category}`;

        for (const receipt of receipts) {
            if (receipt.content) {
                zip.file(`${folderPath}/${receipt.filename}`, receipt.content);
            }
        }
    }

    // Generate ZIP buffer
    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    return buffer;
}

/**
 * Creates a ZIP buffer for browser download (returns Blob)
 */
export async function createTaxSeasonZipBlob(options: CreateZipOptions): Promise<Blob> {
    const { csv, organizedReceipts, year } = options;

    const zip = new JSZip();

    // Add CSV file
    const csvFilename = `${year}-tax-summary.csv`;
    zip.file(csvFilename, csv);

    // Add receipt folders and files
    for (const [category, receipts] of Object.entries(organizedReceipts)) {
        const folderPath = `receipts/${category}`;

        for (const receipt of receipts) {
            if (receipt.content) {
                zip.file(`${folderPath}/${receipt.filename}`, receipt.content);
            }
        }
    }

    // Generate ZIP blob for browser download
    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
    });

    return blob;
}

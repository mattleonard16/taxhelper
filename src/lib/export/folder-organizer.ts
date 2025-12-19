/**
 * Folder organization utilities for tax season export
 * Organizes receipts by category for ZIP export
 */

interface Receipt {
    path: string;
    category: string;
    content?: Buffer;
}

interface OrganizedReceipt {
    path: string;
    filename: string;
    exportPath: string;
    content?: Buffer;
}

type OrganizedReceipts = Record<string, OrganizedReceipt[]>;

/**
 * Extracts filename from a full path
 */
function extractFilename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
}

/**
 * Organizes receipts into category folders for export
 * Returns a map of category -> array of receipt info
 */
export function organizeReceiptsByCategory(receipts: Receipt[]): OrganizedReceipts {
    const organized: OrganizedReceipts = {};

    for (const receipt of receipts) {
        const { category, path, content } = receipt;

        if (!organized[category]) {
            organized[category] = [];
        }

        const filename = extractFilename(path);
        const exportPath = `receipts/${category}/${filename}`;

        organized[category].push({
            path,
            filename,
            exportPath,
            content,
        });
    }

    return organized;
}

/**
 * Generates a flat list of all files to include in the export
 */
export function flattenOrganizedReceipts(organized: OrganizedReceipts): OrganizedReceipt[] {
    const files: OrganizedReceipt[] = [];

    for (const category of Object.keys(organized)) {
        files.push(...organized[category]);
    }

    return files;
}

/**
 * Gets all unique categories from organized receipts
 */
export function getCategories(organized: OrganizedReceipts): string[] {
    return Object.keys(organized).sort();
}

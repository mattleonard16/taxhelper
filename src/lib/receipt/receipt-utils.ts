/**
 * Receipt file utilities following the invoice-organizer standard
 * Format: YYYY-MM-DD Vendor - Receipt - Description.ext
 */

import { TransactionType } from '@/lib/schemas';

interface GenerateFilenameOptions {
    date?: Date;
    vendor?: string | null;
    description?: string | null;
    extension: string;
}

interface GenerateStoragePathOptions {
    userId: string;
    category?: TransactionType;
    filename: string;
}

/**
 * Sanitizes a string to be safe for use in filenames
 * Removes invalid characters and normalizes whitespace
 */
export function sanitizeFilename(input: string): string {
    if (!input) return '';

    return input
        // Remove invalid filename characters: / \ : * ? " < > |
        .replace(/[\/\\:*?"<>|]/g, '')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        // Trim whitespace
        .trim();
}

/**
 * Generates a standardized receipt filename in invoice-organizer format
 * Format: YYYY-MM-DD Vendor - Receipt - Description.ext
 */
export function generateReceiptFilename(options: GenerateFilenameOptions): string {
    const { extension, description } = options;
    const date = options.date || new Date();
    const vendor = options.vendor || 'Unknown';

    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0];

    // Sanitize vendor name (remove special characters)
    const sanitizedVendor = vendor
        .replace(/[\/\\:*?"<>|']/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Build filename
    let filename = `${dateStr} ${sanitizedVendor} - Receipt`;

    if (description) {
        const sanitizedDesc = sanitizeFilename(description);
        if (sanitizedDesc) {
            filename += ` - ${sanitizedDesc}`;
        }
    }

    filename += `.${extension}`;

    return filename;
}

/**
 * Generates the storage path for a receipt file
 * Format: receipts/{userId}/{category}/{filename}
 */
export function generateStoragePath(options: GenerateStoragePathOptions): string {
    const { userId, filename } = options;
    const category = options.category || 'OTHER';

    return `receipts/${userId}/${category}/${filename}`;
}

/**
 * Extracts the filename from a full storage path
 */
export function extractFilename(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1];
}

/**
 * Gets the file extension from a filename or path
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Gets file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/heic': 'heic',
    };
    return mimeToExt[mimeType] || '';
}

/**
 * Validates that a file is an acceptable receipt format
 * Checks both file extension and optionally MIME type
 */
export function isValidReceiptFile(filename: string, mimeType?: string): boolean {
    const ext = getFileExtension(filename);
    const validExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
    
    // If extension is valid, return true
    if (validExtensions.includes(ext)) {
        return true;
    }
    
    // Fallback to MIME type check for test environments where File.name may not work
    if (mimeType) {
        const validMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
        ];
        return validMimeTypes.includes(mimeType);
    }
    
    return false;
}

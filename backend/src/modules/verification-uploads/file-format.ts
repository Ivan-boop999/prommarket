/**
 * File format detection for verification documents.
 *
 * Unlike avatars (image-only), verification accepts PDF in addition to the
 * image formats, because licenses, certificates, and registration documents
 * are usually PDF. The magic-byte check stays strict: a renamed executable
 * or script must never be stored under a document type.
 */

export type VerificationContentType = 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf'

/** First 12 bytes are enough for PDF and all image signatures. */
export const fileSignatureByteLength = 12

export function detectFileFormat(bytes: Uint8Array): VerificationContentType | null {
  // PDF: starts with %PDF- (0x25 0x50 0x44 0x46 0x2D)
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf'
  }
  // JPEG
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  // HEIC (ISO-BMFF ftyp box)
  if (bytes.length >= 12 && asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4)
    const heifBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'])
    if (heifBrands.has(brand)) return 'image/heic'
  }
  return null
}

export function fileFormatMatchesDeclaredType(
  detected: VerificationContentType,
  declared: VerificationContentType,
): boolean {
  return detected === declared
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

export const ALLOWED_VERIFICATION_CONTENT_TYPES: ReadonlySet<VerificationContentType> = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
])

export const VERIFICATION_UPLOAD_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

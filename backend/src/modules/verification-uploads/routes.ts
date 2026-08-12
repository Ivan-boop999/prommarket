import { OpenAPIHono } from '@hono/zod-openapi'
import { randomUUID } from 'node:crypto'

import { AppError } from '../../http/errors'
import { validationErrorHook } from '../../http/errors'
import type { PrivateStorageRuntime } from '../../storage'
import { createStorageObjectKey } from '../../storage/object-keys'
import type { AuthHttpEnv } from '../auth'
import type { MiddlewareHandler } from 'hono'
import {
  ALLOWED_VERIFICATION_CONTENT_TYPES,
  detectFileFormat,
  fileFormatMatchesDeclaredType,
  VERIFICATION_UPLOAD_MAX_BYTES,
  type VerificationContentType,
} from './file-format'

/**
 * Verification document upload routes. Uses OpenAPIHono (like every other
 * module) but registers the POST handler via the raw `.post()` method rather
 * than `.openapi(route, handler)`, because multipart/form-data is not a body
 * schema the openapi route validator body-checks the way it does JSON.
 */
type CreateVerificationUploadRoutesOptions = {
  requireAuth: MiddlewareHandler
  requireVendor: MiddlewareHandler
  storage: PrivateStorageRuntime
}

export function createVerificationUploadRoutes({
  requireAuth,
  requireVendor,
  storage,
}: CreateVerificationUploadRoutesOptions) {
  const routes = new OpenAPIHono<AuthHttpEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)
  routes.use('*', requireVendor)

  routes.post('/upload', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing "file" field in multipart body')
    }
    if (file.size > VERIFICATION_UPLOAD_MAX_BYTES) {
      throw new AppError(
        400,
        'PAYLOAD_TOO_LARGE',
        `File exceeds the ${VERIFICATION_UPLOAD_MAX_BYTES} byte limit`,
      )
    }
    const declared = file.type as VerificationContentType
    if (!ALLOWED_VERIFICATION_CONTENT_TYPES.has(declared)) {
      throw new AppError(400, 'BAD_REQUEST', `Unsupported content type: ${file.type}`)
    }

    // Read the first bytes for magic-byte detection.
    const buffer = new Uint8Array(Math.min(fileSignatureByteLength, file.size))
    const stream = file.stream()
    const reader = stream.getReader()
    let read = 0
    while (read < buffer.byteLength) {
      const { done, value } = await reader.read()
      if (done) break
      buffer.set(value.subarray(0, Math.min(value.length, buffer.byteLength - read)), read)
      read += value.length
    }
    await reader.cancel()

    const detected = detectFileFormat(buffer)
    if (!detected || !fileFormatMatchesDeclaredType(detected, declared)) {
      throw new AppError(400, 'BAD_REQUEST', 'File content does not match its declared type')
    }

    // Persist directly through the filesystem driver (write-once key).
    const now = new Date()
    const objectKey = createStorageObjectKey({
      namespace: 'verification-documents',
      now,
      id: randomUUID(),
    })

    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const fsDriver = storage.storage as unknown as {
      putObjectOnce?: (key: string, body: Uint8Array, contentType: string) => Promise<unknown>
    }
    if (typeof fsDriver.putObjectOnce !== 'function') {
      throw new AppError(500, 'INTERNAL_ERROR', 'Direct upload requires the filesystem storage driver')
    }
    await fsDriver.putObjectOnce(objectKey, fileBytes, declared)

    let downloadUrl: string | null = null
    try {
      const download = await storage.storage.createDownloadUrl({ key: objectKey, expiresInSeconds: 3600 })
      downloadUrl = download.url
    } catch {
      // Signing may fail if the http routes are not configured; the object is
      // still stored and reachable to a moderator with server access.
    }

    return c.json({ objectKey, contentType: declared, byteSize: file.size, downloadUrl }, 201)
  })

  return routes
}

const fileSignatureByteLength = 12


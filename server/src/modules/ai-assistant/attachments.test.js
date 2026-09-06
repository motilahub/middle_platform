import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAiAttachmentStore } from './attachments.js'

test('AI attachment store sanitizes names and enforces size', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-attachments-'))
  const store = createAiAttachmentStore(root)
  const saved = await store.save({ name: '../hello world.txt', dataUrl: 'data:text/plain;base64,aGVsbG8=' })
  assert.equal(saved.name, 'hello_world.txt')
  assert.equal(saved.size, 5)
  await assert.rejects(() => store.save({ name: 'bad.txt', dataUrl: 'not-a-data-url' }), /格式无效/)
  await fs.rm(root, { recursive: true, force: true })
})

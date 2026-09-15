export async function compressImageFile(file: File, maxBytes = 100 * 1024, maxDimension = 512) {
  const source = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片处理')
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close()
  for (let quality = 0.86; quality >= 0.35; quality -= 0.08) {
    const dataUrl = canvas.toDataURL('image/webp', quality)
    if (dataUrl.length * 0.75 <= maxBytes) return dataUrl
  }
  return canvas.toDataURL('image/webp', 0.28)
}

export function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('无法读取图片文件'))
    reader.readAsDataURL(file)
  })
}

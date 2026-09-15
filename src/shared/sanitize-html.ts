const ALLOWED_TAGS = new Set(['A', 'B', 'BR', 'CODE', 'EM', 'I', 'P', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'U'])
const ALLOWED_ATTRS = new Set(['class', 'href', 'rel', 'target'])

export function sanitizeHtml(value: string) {
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]*>/g, '')
  const document = new DOMParser().parseFromString(value, 'text/html')
  document.body.querySelectorAll('*').forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) { element.replaceWith(document.createTextNode(element.textContent || '')); return }
    Array.from(element.attributes).forEach((attribute) => {
      if (!ALLOWED_ATTRS.has(attribute.name) || (attribute.name === 'href' && !/^(https?:|mailto:)/i.test(attribute.value))) element.removeAttribute(attribute.name)
    })
  })
  return document.body.innerHTML
}

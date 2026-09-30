/**
 * Utilitário de Validação de Arquivos de Imagem por Magic Bytes
 * 
 * Previne MIME-type Spoofing: não confia apenas no cabeçalho `Content-Type`
 * enviado pelo cliente HTTP ou na extensão `.png`/`.jpg` do nome do arquivo.
 * Inspeciona diretamente os primeiros bytes (assinatura hexadecimal binária)
 * presentes no Buffer em memória.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
];

/**
 * Inspeciona o Buffer em busca da assinatura de formato de imagem (Magic Bytes)
 * 
 * @param {Buffer} buffer - Buffer de memória do arquivo enviado
 * @returns {{ valid: boolean, mime: string|null, ext: string|null, error?: string }}
 */
export function validateImageMagicBytes(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return {
      valid: false,
      mime: null,
      ext: null,
      error: 'Arquivo vazio ou formato binário corrompido.'
    };
  }

  // 1. JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg', ext: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A (\x89PNG\r\n\x1a\n)
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
  ) {
    return { valid: true, mime: 'image/png', ext: 'png' };
  }

  // 3. WebP: RIFF (bytes 0-3 = 52 49 46 46) e WEBP (bytes 8-11 = 57 45 42 50)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mime: 'image/webp', ext: 'webp' };
  }

  // 4. GIF: GIF87a ou GIF89a (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { valid: true, mime: 'image/gif', ext: 'gif' };
  }

  return {
    valid: false,
    mime: null,
    ext: null,
    error: 'Tipo de arquivo inválido. O conteúdo binário do arquivo não corresponde a uma imagem válida (JPEG, PNG, WebP ou GIF).'
  };
}

// API key Anthropic của người dùng: chỉ nằm trong trình duyệt của họ, không bao giờ gửi đi đâu ngoài api.anthropic.com.
// Mặc định giữ trong sessionStorage (mất khi đóng tab); chỉ lưu localStorage khi người dùng chọn "nhớ".

const KEY = 'chess-review:anthropic-api-key'

function storages(): Storage[] {
  const result: Storage[] = []
  try {
    result.push(sessionStorage)
  } catch {
    // bị chặn: bỏ qua
  }
  try {
    result.push(localStorage)
  } catch {
    // bị chặn: bỏ qua
  }
  return result
}

export function readApiKey(): string | null {
  for (const storage of storages()) {
    try {
      const value = storage.getItem(KEY)
      if (value) return value
    } catch {
      // bỏ qua
    }
  }
  return null
}

export function saveApiKey(apiKey: string, remember: boolean) {
  clearApiKey()
  try {
    ;(remember ? localStorage : sessionStorage).setItem(KEY, apiKey)
  } catch {
    // Không lưu được: key vẫn dùng được trong phiên hiện tại qua state của React
  }
}

export function clearApiKey() {
  for (const storage of storages()) {
    try {
      storage.removeItem(KEY)
    } catch {
      // bỏ qua
    }
  }
}

/** Kiểm tra sơ bộ để báo sớm khi dán nhầm (không thay cho kiểm tra của API). */
export function looksLikeApiKey(value: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(value.trim())
}

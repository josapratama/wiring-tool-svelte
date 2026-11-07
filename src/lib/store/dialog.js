import { writable } from 'svelte/store'

export const dialogState = writable({
  isOpen: false,
  type: 'alert', // 'alert' | 'confirm' | 'prompt'
  title: '',
  message: '',
  icon: 'ℹ️',
  confirmText: 'OK',
  cancelText: 'Batal',
  danger: false,
  inputValue: '',
  inputPlaceholder: '',
  resolve: null
})

/**
 * Show modern Alert modal
 * @param {string | {title?: string, message: string, icon?: string, confirmText?: string}} options 
 * @returns {Promise<void>}
 */
export function showAlert(options) {
  const opts = typeof options === 'string' ? { message: options } : options
  return new Promise(resolve => {
    dialogState.set({
      isOpen: true,
      type: 'alert',
      title: opts.title || 'Informasi',
      message: opts.message || '',
      icon: opts.icon || 'ℹ️',
      confirmText: opts.confirmText || 'OK',
      cancelText: '',
      danger: false,
      inputValue: '',
      inputPlaceholder: '',
      resolve: () => {
        dialogState.update(s => ({ ...s, isOpen: false }))
        resolve(true)
      }
    })
  })
}

/**
 * Show modern Confirm modal
 * @param {string | {title?: string, message: string, icon?: string, confirmText?: string, cancelText?: string, danger?: boolean}} options 
 * @returns {Promise<boolean>}
 */
export function showConfirm(options) {
  const opts = typeof options === 'string' ? { message: options } : options
  return new Promise(resolve => {
    dialogState.set({
      isOpen: true,
      type: 'confirm',
      title: opts.title || 'Konfirmasi',
      message: opts.message || '',
      icon: opts.icon || '❓',
      confirmText: opts.confirmText || 'Ya, Lanjutkan',
      cancelText: opts.cancelText || 'Batal',
      danger: Boolean(opts.danger),
      inputValue: '',
      inputPlaceholder: '',
      resolve: (result) => {
        dialogState.update(s => ({ ...s, isOpen: false }))
        resolve(Boolean(result))
      }
    })
  })
}

/**
 * Show modern Prompt input modal
 * @param {string | {title?: string, message: string, defaultValue?: string, placeholder?: string, icon?: string, confirmText?: string, cancelText?: string}} options 
 * @returns {Promise<string | null>}
 */
export function showPrompt(options) {
  const opts = typeof options === 'string' ? { message: options } : options
  return new Promise(resolve => {
    dialogState.set({
      isOpen: true,
      type: 'prompt',
      title: opts.title || 'Ubah Nilai',
      message: opts.message || '',
      icon: opts.icon || '✏️',
      confirmText: opts.confirmText || 'Simpan',
      cancelText: opts.cancelText || 'Batal',
      danger: false,
      inputValue: opts.defaultValue ?? '',
      inputPlaceholder: opts.placeholder ?? '',
      resolve: (result) => {
        dialogState.update(s => ({ ...s, isOpen: false }))
        resolve(result !== null && result !== undefined ? String(result) : null)
      }
    })
  })
}

export function closeDialog(result = null) {
  dialogState.update(s => {
    if (s.resolve) {
      if (s.type === 'confirm') s.resolve(false)
      else if (s.type === 'prompt') s.resolve(null)
      else s.resolve(true)
    }
    return { ...s, isOpen: false }
  })
}

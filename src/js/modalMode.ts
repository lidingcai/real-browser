// let isModalMode = false

export const modalMode = {
  isModalMode: false,
  onDismiss: null as (() => void) | null,
  enabled() {
    return modalMode.isModalMode
  },
  toggle(enabled: boolean, listeners: { onDismiss: () => void } = { onDismiss: () => {} }) {
    if (enabled && listeners.onDismiss) {
      modalMode.onDismiss = listeners.onDismiss
    }

    if (!enabled) {
      modalMode.onDismiss = null
    }

    modalMode.isModalMode = enabled
    if (enabled) {
      document.body.classList.add('is-modal-mode')
    } else {
      document.body.classList.remove('is-modal-mode')
    }
  },
}

export const initModalMode = () => {
  const overlay = document.getElementById('overlay')!

  overlay.addEventListener('click', () => {
    if (modalMode.onDismiss) {
      modalMode.onDismiss()
      modalMode.onDismiss = null
    }
  })
}

// module.exports = modalMode

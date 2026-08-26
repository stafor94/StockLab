import { fireEvent, render, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { OrderErrorDialog } from './OrderErrorDialog'

describe('OrderErrorDialog', () => {
  it('presents a blocking custom dialog and closes explicitly', async () => {
    const onClose = vi.fn()
    const { container } = render(<OrderErrorDialog message="주문 가능 현금이 부족합니다." onClose={onClose} />)
    const view = within(container)

    const dialog = view.getByRole('alertdialog', { name: '주문을 처리할 수 없습니다' })
    expect(dialog).toBeTruthy()
    expect(view.getByText('주문 가능 현금이 부족합니다.')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(view.getByRole('button', { name: '확인' })))

    fireEvent.click(view.getByRole('button', { name: '확인' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('supports Escape dismissal', () => {
    const onClose = vi.fn()
    const { container } = render(<OrderErrorDialog message="보유 수량보다 많이 매도할 수 없습니다." onClose={onClose} />)
    const dialog = within(container).getByRole('alertdialog', { name: '주문을 처리할 수 없습니다' })

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

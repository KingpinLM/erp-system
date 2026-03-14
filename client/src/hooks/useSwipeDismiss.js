import { useRef, useCallback } from 'react';

export function useSwipeDismiss(onDismiss, { threshold = 100 } = {}) {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = useCallback((e) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    // Only start drag from near top of sheet (within 60px of top)
    const rect = sheet.getBoundingClientRect();
    const touchY = e.touches[0].clientY;
    if (touchY - rect.top > 60) return;
    startY.current = touchY;
    currentY.current = touchY;
    isDragging.current = true;
    sheet.classList.add('dragging');
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!isDragging.current) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0) {
      sheet.style.transform = `translateY(${delta}px)`;
      sheet.style.opacity = Math.max(0.5, 1 - delta / 400);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.classList.remove('dragging');
    const delta = currentY.current - startY.current;
    if (delta > threshold) {
      sheet.style.transform = `translateY(100%)`;
      sheet.style.opacity = '0';
      setTimeout(onDismiss, 150);
    } else {
      sheet.style.transform = '';
      sheet.style.opacity = '';
    }
  }, [onDismiss, threshold]);

  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}

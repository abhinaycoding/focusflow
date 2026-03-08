import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useMagnetic Hook
 * Provides tilt and proximity values based on mouse position relative to an element.
 */
export const useMagnetic = (active = true) => {
  const ref = useRef(null);
  const [values, setValues] = useState({ x: 0, y: 0, s: 1 });

  const handleMouseMove = useCallback((e) => {
    if (!ref.current || !active) return;

    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = (e.clientX - (left + width / 2)) / (width / 2);
    const y = (e.clientY - (top + height / 2)) / (height / 2);

    setValues({
      x: x * 15, // Tilt amount in degrees
      y: y * -15, 
      s: 1.02 // Subtle scale up
    });
  }, [active]);

  const handleMouseLeave = useCallback(() => {
    setValues({ x: 0, y: 0, s: 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    window.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave, active]);

  const style = {
    transform: `perspective(1000px) rotateX(${values.y}deg) rotateY(${values.x}deg) scale3d(${values.s}, ${values.s}, ${values.s})`,
    transition: values.x === 0 && values.y === 0 ? 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)' : 'transform 0.1s ease-out'
  };

  return { ref, style };
};

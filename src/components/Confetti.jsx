import React, { useEffect, useRef, useState } from 'react';

const Confetti = () => {
  const canvasRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleConfetti = () => {
      setActive(true);
      setTimeout(() => setActive(false), 5000); // 5 seconds of confetti
    };

    window.addEventListener('confetti-burst', handleConfetti);
    return () => window.removeEventListener('confetti-burst', handleConfetti);
  }, []);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const numberOfPieces = 150;
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    for (let i = 0; i < numberOfPieces; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        v: 0,
        r: Math.random() * 4 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngleIncremental: Math.random() * 0.07 + 0.05,
        tiltAngle: 0
      });
    }

    let animationFrameId;

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        piece.v += 0.2; // Gravity
        piece.y += piece.v;
        piece.tiltAngle += piece.tiltAngleIncremental;
        piece.tilt = Math.sin(piece.tiltAngle) * 15;

        ctx.beginPath();
        ctx.lineWidth = piece.r;
        ctx.strokeStyle = piece.color;
        ctx.moveTo(piece.x + piece.tilt + piece.r / 2, piece.y);
        ctx.lineTo(piece.x + piece.tilt, piece.y + piece.tilt + piece.r / 2);
        ctx.stroke();

        if (piece.y > canvas.height) {
          piece.x = Math.random() * canvas.width;
          piece.y = -20;
          piece.v = Math.random() * 2;
        }
      }

      animationFrameId = requestAnimationFrame(update);
    };

    update();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
};

export default Confetti;

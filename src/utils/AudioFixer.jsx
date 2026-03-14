import React, { useEffect } from 'react';

/**
 * AudioFixer Component
 * 
 * Auto-resumes Web Audio API context on the first user interaction.
 * This satisfies browser autoplay policies and fixes "suspended" audio issues.
 */
const AudioFixer = () => {
    useEffect(() => {
        const resumeAudio = async () => {
            // Handle AudioContext
            const audioCtx = window.AudioContext || window.webkitAudioContext;
            if (audioCtx) {
                const dummyCtx = new audioCtx();
                if (dummyCtx.state === 'suspended') {
                    const resume = () => {
                        dummyCtx.resume().then(() => {
                            console.log('[AudioFixer] AudioContext Resumed');
                            window.removeEventListener('click', resume);
                            window.removeEventListener('keydown', resume);
                            window.removeEventListener('touchstart', resume);
                        });
                    };
                    window.addEventListener('click', resume);
                    window.addEventListener('keydown', resume);
                    window.addEventListener('touchstart', resume);
                }
            }
        };

        resumeAudio();
    }, []);

    return null;
};

export default AudioFixer;

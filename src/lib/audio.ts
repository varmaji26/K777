// A simple audio utility to play sounds in the app.

// Create a single audio instance that can be reused.
let clickAudio: HTMLAudioElement | null = null;

const initializeAudio = () => {
    // Only create the audio element in the browser and only if it doesn't exist.
    if (typeof window !== 'undefined' && !clickAudio) {
        // Using a publicly available, short click sound.
        clickAudio = new Audio('https://s3-us-west-2.amazonaws.com/s.cdpn.io/123941/click.mp3');
        clickAudio.preload = 'auto';
        
        // Some mobile browsers require the audio to be "unlocked" by a user action.
        // We can try to load it silently.
        clickAudio.load();
    }
    return clickAudio;
}

export const playClickSound = () => {
    const audio = initializeAudio();
    if (audio) {
        // If the audio is already playing, reset it to the start.
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
        
        // Play the sound.
        audio.play().catch(error => {
            // Autoplay was prevented, which is common in browsers, especially on the first interaction.
            // This is a normal restriction and we can often ignore it for simple UI sounds.
            // console.error("Audio play failed:", error);
        });
    }
};

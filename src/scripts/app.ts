// CalTrack Main Application Entry Point
import '../styles/main.css';
import { CalTrackApp } from './core/CalTrackApp';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new CalTrackApp();
  app.initialize();
});

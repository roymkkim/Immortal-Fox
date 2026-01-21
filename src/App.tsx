
import React, { useState, useEffect, useRef } from 'react';
import ThreeScene, { ThreeSceneHandle } from './components/ThreeScene';

const FOX_MODEL_URL = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Fox/glTF-Binary/Fox.glb";

const App: React.FC = () => {
  const [mushroomsCollected, setMushroomsCollected] = useState(0);
  const [isMobileStarted, setIsMobileStarted] = useState(false);
  const sceneRef = useRef<ThreeSceneHandle>(null);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  useEffect(() => {
    document.title = "The Fox's Journey";
    document.body.style.backgroundColor = '#2F5D50'; // Match floor color
  }, []);

  const handleRestart = () => {
    if (sceneRef.current) {
      sceneRef.current.resetGame();
    }
  };

  const startMobile = async () => {
    if (sceneRef.current) {
      const granted = await sceneRef.current.startMobileMotion();
      if (granted) setIsMobileStarted(true);
      else {
        setIsMobileStarted(true);
      }
    }
  };

  return (
    <div className={`relative w-full h-screen overflow-hidden font-sans text-white`}>
      <ThreeScene 
        ref={sceneRef}
        isDarkMode={false} 
        externalModelUrl={FOX_MODEL_URL}
        onMushroomCollect={(count) => setMushroomsCollected(count)}
        initialMushroomCount={mushroomsCollected}
      />

      {/* Mobile Permission Overlay */}
      {isMobile && !isMobileStarted && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-10 text-center">
          <h2 className="text-xl tracking-[0.4em] uppercase mb-4">The Immortal Fox</h2>
          <p className="text-[10px] tracking-[0.2em] uppercase opacity-60 mb-8 leading-relaxed">
            Tilt your phone to steer.<br/>The fox moves forward automatically.
          </p>
          <button 
            onClick={startMobile}
            className="px-8 py-4 border border-white/20 text-[10px] tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all"
          >
            Start Adventure
          </button>
        </div>
      )}

      {/* Responsive HUD Header */}
      <div className="absolute top-6 left-0 w-full flex flex-col md:flex-row md:justify-between px-6 md:px-10 pointer-events-none z-10 space-y-6 md:space-y-0">
        
        {/* Branding */}
        <div className="flex flex-col items-center md:items-start">
          <h1 className="text-[11px] md:text-sm font-light tracking-[0.6em] md:tracking-[0.8em] uppercase opacity-90 text-center md:text-left">
            The Immortal Fox
          </h1>
          <div className="w-12 h-[1px] bg-white/20 mt-2 md:hidden"></div>
        </div>

        {/* Collection Tracker */}
        <div className="flex flex-col items-center md:items-end">
          <span className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.4em] mb-3 opacity-60">
            MUSHROOMS
          </span>
          <div className="flex space-x-3 items-center">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-700 ${
                  i < mushroomsCollected 
                    ? 'bg-[#E2725B] scale-125 shadow-[0_0_12px_rgba(226,114,91,0.8)]' 
                    : 'bg-white/20'
                }`} 
              />
            ))}
          </div>
          <div className="mt-4">
             <span className={`text-[8px] md:text-[9px] font-semibold ${mushroomsCollected >= 5 ? 'text-[#ffd700]' : 'text-white'} tracking-[0.2em] md:tracking-[0.3em] uppercase transition-colors duration-500 text-center`}>
              {mushroomsCollected >= 5 ? "Find Gold for Immunity" : `${mushroomsCollected} / 5 Found`}
            </span>
          </div>
        </div>
      </div>

      {/* Controls Help (Desktop Only) */}
      {!isMobile && (
        <div className="absolute bottom-10 left-10 select-none pointer-events-none z-10 hidden md:block">
          <div className="text-[9px] uppercase tracking-[0.4em] flex flex-col space-y-3 opacity-70">
            <div className="flex items-center space-x-2">
              <span className="w-4 h-[1px] bg-white"></span>
              <span>WASD to Explore</span>
            </div>
          </div>
        </div>
      )}

      {/* Restart Button */}
      <div className="absolute bottom-6 md:bottom-10 right-6 md:right-10 flex flex-col items-end z-10">
        <button 
          onClick={handleRestart}
          className="group flex flex-col items-end space-y-2 focus:outline-none"
        >
          <span className="text-[9px] md:text-[10px] uppercase tracking-[0.4em] opacity-40 group-hover:opacity-100 transition-opacity">
            Reset Realm
          </span>
          <div className="w-8 md:w-12 h-[1px] bg-white/20 group-hover:bg-[#E2725B] group-hover:w-16 transition-all duration-500"></div>
        </button>
      </div>
    </div>
  );
};

export default App;

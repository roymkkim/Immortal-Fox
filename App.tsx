
import React, { useState, useEffect, useRef } from 'react';
import { Analytics } from '@vercel/analytics/react';
import ThreeScene, { ThreeSceneHandle } from './components/ThreeScene';

const FOX_MODEL_URL = "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/Fox/glTF-Binary/Fox.glb";

const App: React.FC = () => {
  const isDarkMode = false;
  const [mushroomsCollected, setMushroomsCollected] = useState(0);
  const sceneRef = useRef<ThreeSceneHandle>(null);

  useEffect(() => {
    document.title = "The Fox's Journey";
    document.body.style.backgroundColor = '#88ccff';
  }, []);

  const handleRestart = () => {
    if (sceneRef.current) {
      sceneRef.current.resetGame();
    }
  };

  const uiColorClass = 'text-white';
  const brandColorClass = 'text-white';

  return (
    <div className={`relative w-full h-screen overflow-hidden font-sans`}>
      <ThreeScene 
        ref={sceneRef}
        isDarkMode={isDarkMode} 
        externalModelUrl={FOX_MODEL_URL}
        onMushroomCollect={(count) => setMushroomsCollected(count)}
        initialMushroomCount={mushroomsCollected}
      />
      <Analytics />

      {/* Top Left Branding */}
      <div className="absolute top-10 left-10 flex flex-col pointer-events-none select-none">
        <h1 className={`text-sm font-light tracking-[0.8em] uppercase ${brandColorClass} opacity-90`}>
          The Immortal Fox
        </h1>
      </div>

      {/* Collection Tracker */}
      <div className="absolute top-10 right-10 flex flex-col items-end pointer-events-none select-none">
        <span className={`text-[10px] font-medium uppercase tracking-[0.4em] mb-4 ${uiColorClass} opacity-60`}>
          MUSHROOMS
        </span>
        <div className="flex space-x-3">
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
           <span className={`text-[9px] font-semibold ${mushroomsCollected >= 5 ? 'text-[#ffd700]' : uiColorClass} tracking-[0.3em] uppercase transition-colors duration-500`}>
            {mushroomsCollected >= 5 ? "Find the Gold Mushroom for Immunity" : `${mushroomsCollected} / 5 Found`}
          </span>
        </div>
      </div>

      {/* Controls Help */}
      <div className="absolute bottom-10 left-10 select-none pointer-events-none">
        <div className={`text-[9px] uppercase tracking-[0.4em] flex flex-col space-y-3 ${uiColorClass} opacity-70`}>
          <div className="flex items-center space-x-2">
            <span className="w-4 h-[1px] bg-white"></span>
            <span>WASD to Explore</span>
          </div>
        </div>
      </div>

      {/* Restart Button */}
      <div className="absolute bottom-10 right-10 flex flex-col items-end">
        <button 
          onClick={handleRestart}
          className="group flex flex-col items-end space-y-2 focus:outline-none"
        >
          <span className="text-[10px] uppercase tracking-[0.4em] text-white opacity-40 group-hover:opacity-100 transition-opacity">
            Reset Realm
          </span>
          <div className="w-12 h-[1px] bg-white/20 group-hover:bg-[#E2725B] group-hover:w-16 transition-all duration-500"></div>
        </button>
      </div>
    </div>
  );
};

export default App;

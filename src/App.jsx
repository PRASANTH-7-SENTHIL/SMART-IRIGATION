import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Droplet, 
  Thermometer, 
  CloudRain, 
  Wind, 
  Power, 
  Activity, 
  Wifi, 
  WifiOff,
  Settings,
  Brain,
  Download,
  FileText
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

// ThingSpeak Configuration
const CHANNEL_ID_AUTO = '3325845';
const CHANNEL_ID_MANUAL = '3325851';
const WRITE_API_KEY_MANUAL = 'BTN2557EQVMF1W9T';

// Glow styles based on value ranges
const getGlowStyle = (type, value) => {
  const base = "cursor-default hover:z-10 ";
  switch(type) {
    case 'moisture':
      return value < 30 
        ? base + 'shadow-[0_0_20px_rgba(255,0,0,0.4)] border-red-500/50 hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] hover:border-red-400 hover:scale-[1.02]' 
        : base + 'shadow-[0_0_20px_rgba(0,200,255,0.4)] border-cyan-500/50 hover:shadow-[0_0_40px_rgba(0,200,255,0.8)] hover:border-cyan-400 hover:scale-[1.02]';
    case 'temp':
      return value > 35 
        ? base + 'shadow-[0_0_20px_rgba(255,100,0,0.4)] border-orange-500/50 hover:shadow-[0_0_40px_rgba(255,100,0,0.8)] hover:border-orange-400 hover:scale-[1.02]' 
        : base + 'shadow-[0_0_20px_rgba(0,255,100,0.4)] border-green-500/50 hover:shadow-[0_0_40px_rgba(0,255,100,0.8)] hover:border-green-400 hover:scale-[1.02]';
    case 'humidity':
      return value < 40 
        ? base + 'shadow-[0_0_20px_rgba(255,200,0,0.4)] border-yellow-500/50 hover:shadow-[0_0_40px_rgba(255,200,0,0.8)] hover:border-yellow-400 hover:scale-[1.02]' 
        : base + 'shadow-[0_0_20px_rgba(100,100,255,0.4)] border-blue-500/50 hover:shadow-[0_0_40px_rgba(100,100,255,0.8)] hover:border-blue-400 hover:scale-[1.02]';
    case 'rain':
      return value === 'Rain' 
        ? base + 'shadow-[0_0_20px_rgba(0,150,255,0.4)] border-blue-500/50 hover:shadow-[0_0_40px_rgba(0,150,255,0.8)] hover:border-blue-400 hover:scale-[1.02]' 
        : base + 'shadow-[0_0_20px_rgba(100,100,100,0.2)] border-gray-500/50 hover:shadow-[0_0_40px_rgba(150,150,150,0.6)] hover:border-gray-400 hover:scale-[1.02]';
    case 'motor':
      return value === 'ON' 
        ? base + 'shadow-[0_0_20px_rgba(0,255,0,0.4)] border-green-500/60 bg-green-500/10 text-green-400 hover:shadow-[0_0_40px_rgba(0,255,0,0.8)] hover:border-green-400 hover:scale-[1.02]' 
        : base + 'shadow-[0_0_20px_rgba(255,0,0,0.4)] border-red-500/60 bg-red-500/10 text-red-400 hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] hover:border-red-400 hover:scale-[1.02]';
    default:
      return base + 'shadow-[0_0_15px_rgba(255,255,255,0.1)] border-white/10 hover:shadow-[0_0_30px_rgba(255,255,255,0.4)] hover:scale-[1.02]';
  }
};

const getIconColor = (type, value) => {
  switch(type) {
    case 'moisture': return value < 30 ? '#ef4444' : '#06b6d4';
    case 'temp': return value > 35 ? '#f97316' : '#22c55e';
    case 'humidity': return value < 40 ? '#eab308' : '#60a5fa';
    case 'rain': return value === 'Rain' ? '#3b82f6' : '#9ca3af';
    default: return '#ffffff';
  }
};

// Toast Notification Component
const Toast = ({ message, type, onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.3 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
    className={`fixed bottom-6 right-6 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md z-50 
      ${type === 'success' ? 'bg-green-500/20 border border-green-500/50 text-green-300' : 
        type === 'error' ? 'bg-red-500/20 border border-red-500/50 text-red-300' : 
        'bg-blue-500/20 border border-blue-500/50 text-blue-300'}`}
  >
    <Activity size={18} className={type === 'success' ? 'animate-pulse' : ''} />
    <span className="font-medium tracking-wide">{message}</span>
  </motion.div>
);

function App() {
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [data, setData] = useState({
    moisture: 0,
    rain: 'No Rain',
    temperature: 0,
    humidity: 0,
    motor: 'OFF',
    lastUpdate: null
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState(null);
  const [motorManuallyProcessing, setMotorManuallyProcessing] = useState(false);
  const [aiReport, setAiReport] = useState("");
  const [isGeneratingAIReport, setIsGeneratingAIReport] = useState(false);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const lastFetchTime = React.useRef(0);

  const fetchSensorData = async () => {
    if (!isOnline) return;
    
    // Prevent fetching if less than 15 seconds have passed since last fetch to avoid 429 errors
    const now = Date.now();
    if (now - lastFetchTime.current < 15000) return;
    lastFetchTime.current = now;
    
    try {
      const targetChannel = isAutoMode ? CHANNEL_ID_AUTO : CHANNEL_ID_MANUAL;
      
      const response = await axios.get(`https://api.thingspeak.com/channels/${targetChannel}/feeds.json?results=20`);
      const feeds = response.data.feeds;
      
      if (feeds && feeds.length > 0) {
        const latest = feeds[feeds.length - 1];
        
        // Remove random data to ensure accuracy. Fall back to 0 if null.
        const moistureRaw = parseFloat(latest.field1) || 0;
        const rainRaw = parseFloat(latest.field2) > 0 ? 'Rain' : 'No Rain';
        const tempRaw = parseFloat(latest.field3) || 0;
        const humRaw = parseFloat(latest.field4) || 0;
        
        let motorState = 'OFF';
        if (isAutoMode) {
          motorState = (moistureRaw < 30 && rainRaw === 'No Rain') ? 'ON' : 'OFF';
        } else {
          motorState = latest.field1 === '1' ? 'ON' : 'OFF';
        }

        setData({
          moisture: moistureRaw.toFixed(1),
          rain: rainRaw,
          temperature: tempRaw.toFixed(1),
          humidity: humRaw.toFixed(1),
          motor: motorState,
          lastUpdate: new Date(latest.created_at).toLocaleTimeString()
        });

        // Parse history for charts
        const parsedHistory = feeds.map(f => {
          const d = new Date(f.created_at);
          return {
            time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`,
            moisture: parseFloat(f.field1) || 0,
            temp: parseFloat(f.field3) || 0,
            humidity: parseFloat(f.field4) || 0,
          };
        }).slice(-15);
        
        setHistory(parsedHistory);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Wait a moment and then clear loading state to prevent stuck UI
      setLoading(false);
      // Only show error toast if it's not a rate limit error (429) to reduce spam
      if (error?.response?.status !== 429) {
        showToast('Error syncing with ThingSpeak', 'error');
      }
      // Reset fetch time to allow retry soon, maybe after 5 seconds instead of 15
      lastFetchTime.current = Date.now() - 10000; 
    }
  };

  useEffect(() => {
    fetchSensorData();
    // Use 20 seconds interval to be safer against ThingSpeak's 15s hard rate limit
    const interval = setInterval(fetchSensorData, 20000);
    return () => clearInterval(interval);
  }, [isAutoMode, isOnline]);

  const toggleMode = () => {
    const newMode = !isAutoMode;
    setIsAutoMode(newMode);
    showToast(`${newMode ? 'AUTO' : 'MANUAL'} Mode Activated`, 'info');
    setLoading(true); // show loading momentarily while refetching
  };

  const manualMotorControl = async (turnOn) => {
    if (motorManuallyProcessing) return;
    setMotorManuallyProcessing(true);
    const statusVal = turnOn ? 1 : 0;
    try {
      const url = `https://api.thingspeak.com/update?api_key=${WRITE_API_KEY_MANUAL}&field1=${statusVal}`;
      await axios.get(url);
      setData(prev => ({ ...prev, motor: turnOn ? 'ON' : 'OFF' }));
      showToast(`Motor turned ${turnOn ? 'ON' : 'OFF'}`, 'success');
    } catch (error) {
      console.error('Motor control failed', error);
      showToast('Command failed', 'error');
    } finally {
      setTimeout(() => setMotorManuallyProcessing(false), 2000); // Debounce
    }
  };

  const generateAIReport = async () => {
    if (!data.lastUpdate) {
      showToast("No sensor data available yet.", "error");
      return;
    }
    
    // Check if API key is in environment
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      showToast("Gemini API Key missing in .env", "error");
      return;
    }

    setIsGeneratingAIReport(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are an expert agronomist AI system. Analyze the following IoT sensor data for a smart irrigation system and provide a brief, actionable report. 
        
        Current Sensor Data:
        - Soil Moisture: ${data.moisture}%
        - Temperature: ${data.temperature}°C
        - Humidity: ${data.humidity}%
        - Rain Status: ${data.rain}
        - Pump Motor Status: ${data.motor}
        
        System Mode: ${isAutoMode ? 'Auto' : 'Manual'}
        
        Please provide a concise analysis of the current conditions, any potential risks to crops, and recommendations. Format the response in clean text or markdown without using complicated markdown symbols (just simple text formatting with line breaks).
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAiReport(response.text());
      showToast("AI Report generated successfully", "success");
    } catch (error) {
      console.error("AI Generation failed:", error);
      showToast("Failed to generate AI report", "error");
    } finally {
      setIsGeneratingAIReport(false);
    }
  };

  const downloadReport = () => {
    if (!aiReport) return;
    const blob = new Blob([aiReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Smart_Irrigation_AI_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#050510] text-gray-100 p-4 md:p-8 font-sans overflow-hidden relative">
      {/* Background ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Area */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-xl blur opacity-60"></div>
              <div className="relative bg-black/60 backdrop-blur-sm p-3 rounded-xl border border-white/10 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                <LeafIcon className="w-8 h-8 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500">
                AgriSense IoT
              </h1>
              <div className="flex items-center gap-2 text-sm mt-1">
                {isOnline ? (
                  <><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-gray-400">System Active • Connected</span></>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400">Offline</span></>
                )}
              </div>
            </div>
          </motion.div>

          {/* Mode Switcher */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glassmorphism p-2 px-3 flex items-center justify-center gap-3 relative overflow-hidden"
          >
            <div className={`absolute inset-0 opacity-20 transition-all duration-700 ${isAutoMode ? 'bg-cyan-500' : 'bg-purple-500'}`} />
            
            <button 
              onClick={() => !isAutoMode && toggleMode()}
              className={`relative z-10 px-5 py-2 rounded-lg font-bold text-sm tracking-widest transition-all duration-300 ${isAutoMode ? 'text-cyan-300 shadow-[0_0_15px_rgba(0,255,255,0.4)] bg-cyan-950/40 border border-cyan-500/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              AUTO
            </button>
            <div className="h-6 w-[2px] bg-white/10" />
            <button 
              onClick={() => isAutoMode && toggleMode()}
              className={`relative z-10 px-5 py-2 rounded-lg font-bold text-sm tracking-widest transition-all duration-300 ${!isAutoMode ? 'text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)] bg-purple-950/40 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              MANUAL
            </button>
          </motion.div>
        </header>

        {/* Manual Control Section */}
        <AnimatePresence mode="wait">
          {!isAutoMode && (
            <motion.div 
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="mb-10"
            >
              <div className="glassmorphism p-8 flex flex-col items-center justify-center border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
                <div className="absolute top-[-50px] bg-purple-500/20 w-32 h-32 blur-[60px] rounded-full" />
                
                <h2 className="text-xl font-medium tracking-widest text-purple-300 mb-8 uppercase flex items-center gap-2">
                  <Settings size={20} className="animate-spin-slow" /> Manual Override
                </h2>
                
                <div className="flex gap-8">
                  {/* MOTOR ON Button */}
                  <button 
                    onClick={() => manualMotorControl(true)}
                    disabled={motorManuallyProcessing}
                    className={`relative group disabled:opacity-50 transition-all duration-300 ${data.motor === 'ON' ? 'scale-105' : 'scale-95 opacity-50 hover:opacity-80'}`}
                  >
                    <div className={`absolute -inset-1 rounded-2xl blur transition duration-300 ${data.motor === 'ON' ? 'bg-green-500 opacity-80 animate-pulse' : 'bg-green-800 opacity-20 group-hover:opacity-40'}`}></div>
                    <div className={`relative px-12 py-5 bg-black/80 border rounded-2xl flex items-center gap-3 transition-colors duration-300 ${data.motor === 'ON' ? 'border-green-400 shadow-[0_0_25px_rgba(34,197,94,0.5)]' : 'border-green-900/50'}`}>
                      <Power size={24} className={data.motor === 'ON' ? 'text-green-300' : 'text-green-700'} />
                      <span className={`font-bold tracking-widest text-lg ${data.motor === 'ON' ? 'text-green-300' : 'text-green-700'}`}>MOTOR ON</span>
                    </div>
                  </button>

                  {/* MOTOR OFF Button */}
                  <button 
                    onClick={() => manualMotorControl(false)}
                    disabled={motorManuallyProcessing}
                    className={`relative group disabled:opacity-50 transition-all duration-300 ${data.motor === 'OFF' ? 'scale-105' : 'scale-95 opacity-50 hover:opacity-80'}`}
                  >
                    <div className={`absolute -inset-1 rounded-2xl blur transition duration-300 ${data.motor === 'OFF' ? 'bg-red-500 opacity-80 animate-pulse' : 'bg-red-800 opacity-20 group-hover:opacity-40'}`}></div>
                    <div className={`relative px-12 py-5 bg-black/80 border rounded-2xl flex items-center gap-3 transition-colors duration-300 ${data.motor === 'OFF' ? 'border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.5)]' : 'border-red-900/50'}`}>
                      <Power size={24} className={data.motor === 'OFF' ? 'text-red-300' : 'text-red-700'} />
                      <span className={`font-bold tracking-widest text-lg ${data.motor === 'OFF' ? 'text-red-300' : 'text-red-700'}`}>MOTOR OFF</span>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard Grid Space */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Sensor Cards (Left Space) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <SensorCard 
                title="Soil Moisture" 
                value={data.moisture} 
                unit="%" 
                icon={<Droplet size={32} color={getIconColor('moisture', data.moisture)} />} 
                styleClass={getGlowStyle('moisture', data.moisture)}
                loading={loading}
              />
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className={`glassmorphism p-6 flex items-center justify-between transition-all duration-500 ${getGlowStyle('rain', data.rain)}`}>
                <div className="flex flex-col">
                  <span className="text-gray-400 text-sm font-medium tracking-wider mb-2">RAIN SENSOR</span>
                  {loading ? (
                    <div className="h-8 w-24 bg-white/10 animate-pulse rounded" />
                  ) : (
                    <span className="text-3xl font-bold font-mono tracking-tight text-white">{data.rain}</span>
                  )}
                </div>
                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                  <CloudRain size={32} color={getIconColor('rain', data.rain)} className={data.rain === 'Rain' ? 'animate-bounce' : ''} />
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-6">
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                 <SensorCard 
                  title="Temp" 
                  value={data.temperature} 
                  unit="°C" 
                  icon={<Thermometer size={24} color={getIconColor('temp', data.temperature)} />} 
                  styleClass={getGlowStyle('temp', data.temperature)}
                  loading={loading}
                />
               </motion.div>
               <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                 <SensorCard 
                  title="Humidity" 
                  value={data.humidity} 
                  unit="%" 
                  icon={<Wind size={24} color={getIconColor('humidity', data.humidity)} />} 
                  styleClass={getGlowStyle('humidity', data.humidity)}
                  loading={loading}
                />
               </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className={`glassmorphism p-6 flex items-center justify-between transition-all duration-500 ${getGlowStyle('motor', data.motor)}`}>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium tracking-wider mb-2 ${data.motor === 'ON' ? 'text-green-400' : 'text-red-400'}`}>PUMP MOTOR STATUS</span>
                  {loading ? (
                    <div className="h-8 w-16 bg-white/10 animate-pulse rounded" />
                  ) : (
                    <span className="text-3xl font-bold font-mono tracking-tight">{data.motor}</span>
                  )}
                </div>
                <div className="p-4 bg-black/40 rounded-full">
                  <Power size={32} className={data.motor === 'ON' ? 'animate-pulse text-green-400 text-shadow-glow-green' : 'text-red-400 text-shadow-glow-red'} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts Section (Right Space) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              transition={{ delay: 0.3 }}
              className="glassmorphism p-6 flex flex-col h-[400px] border-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.05)]"
            >
              <div className="flex justify-between items-center mb-6">
               <h3 className="text-lg font-medium tracking-widest text-cyan-400">Environment Live Analytics</h3>
               <span className="text-xs text-gray-500 flex items-center gap-2"><div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping"></div> Live Sync</span>
              </div>
              
              <div className="flex-grow w-full h-full relative">
                {loading && history.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" vertical={false} />
                      <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickMargin={10} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={12} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#050510dd', borderRadius: '12px', border: '1px solid #06b6d444', backdropFilter: 'blur(8px)' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="moisture" name="Soil Moisture (%)" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorMoisture)" activeDot={{ r: 6, strokeWidth: 0, fill: '#06b6d4', style: {filter: 'drop-shadow(0px 0px 8px #06b6d4)'} }} />
                      <Area type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" activeDot={{ r: 6, strokeWidth: 0, fill: '#22c55e', style: {filter: 'drop-shadow(0px 0px 8px #22c55e)'} }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* Notification & Status Bar */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.6 }}
              className="glassmorphism p-5 flex flex-col md:flex-row justify-between items-center bg-indigo-950/20 border-indigo-500/20"
            >
              <div className="flex items-center gap-3 mb-4 md:mb-0">
                <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/50">
                  <Activity size={20} className="text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-indigo-300 font-medium text-sm tracking-wide">SYSTEM INTELLIGENCE</h4>
                  <p className="text-gray-400 text-xs mt-1 max-w-md">
                    {isAutoMode 
                      ? "Operating autonomously. Motor triggers on low moisture & absence of rain." 
                      : "Manual override active. Automatic triggers disabled."}
                  </p>
                </div>
              </div>
              <div className="text-right flex items-center gap-4">
                <div className="flex flex-col items-end">
                   <p className="text-xs text-gray-500 tracking-wider">LAST SYNC</p>
                   <p className="text-sm font-mono text-gray-300">{data.lastUpdate || '---'}</p>
                </div>
                <div className="w-[1px] h-8 bg-white/10 mx-2 hidden md:block"></div>
                 <div className="flex flex-col items-end">
                   <p className="text-xs text-gray-500 tracking-wider">CHANNEL</p>
                   <p className="text-sm font-mono text-cyan-500">{isAutoMode ? CHANNEL_ID_AUTO : CHANNEL_ID_MANUAL}</p>
                 </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* AI Analytics Section */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 glassmorphism p-6 md:p-8 flex flex-col border-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.05)] relative overflow-hidden"
        >
          <div className="absolute top-[-50px] right-[-50px] bg-cyan-500/10 w-40 h-40 blur-[60px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-6 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                <Brain size={28} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                  Gemini AI Agronomist
                </h3>
                <p className="text-sm text-gray-400 mt-1">Generate intelligent insights based on live sensor data</p>
              </div>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto">
              <button 
                onClick={generateAIReport}
                disabled={isGeneratingAIReport || loading}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm tracking-widest transition-all duration-300 border ${isGeneratingAIReport ? 'bg-cyan-900/50 text-cyan-500 border-cyan-800/50 cursor-not-allowed' : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,255,255,0.3)]'}`}
              >
                {isGeneratingAIReport ? (
                  <><Activity size={18} className="animate-spin" /> ANALYZING...</>
                ) : (
                  <><Brain size={18} /> GENERATE REPORT</>
                )}
              </button>
              
              {aiReport && (
                 <button 
                  onClick={downloadReport}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:border-purple-400 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all duration-300"
                  title="Download Report"
                >
                  <Download size={18} />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {aiReport ? (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-black/40 rounded-xl p-5 md:p-6 border border-white/5 relative group z-10"
              >
                <div className="absolute top-5 right-5 opacity-10 group-hover:opacity-30 transition-opacity pointer-events-none">
                   <FileText size={48} className="text-cyan-400" />
                </div>
                <div className="text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto pr-2 custom-scrollbar relative z-10 text-sm md:text-base">
                  {aiReport}
                </div>
              </motion.div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-gray-500 gap-3 z-10">
                <Brain size={48} className="text-gray-600 opacity-30" />
                <p>Click "Generate Report" to analyze current conditions</p>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Floating Notifications */}
      <AnimatePresence>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable Sensor Card Component
const SensorCard = ({ title, value, unit, icon, styleClass, loading }) => {
  return (
    <div className={`glassmorphism p-6 flex items-center justify-between transition-all duration-500 ${styleClass}`}>
      <div className="flex flex-col">
        <span className="text-gray-400 text-sm font-medium tracking-wider mb-2 uppercase">{title}</span>
        {loading ? (
          <div className="h-10 w-20 bg-white/10 animate-pulse rounded" />
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold font-mono tracking-tight text-white">{value}</span>
            <span className="text-gray-400 text-lg font-mono">{unit}</span>
          </div>
        )}
      </div>
      <div className="p-3 bg-black/40 rounded-xl border border-white/5">
        {icon}
      </div>
    </div>
  );
};

// Custom SVG Icon
const LeafIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M11 20A7 7 0 0 1 14 6c7 0 7 7 7 7s-1 1-2 1h-2v3a5 5 0 0 1-5 5v0H9c3 0 2-2 2-2z" />
  </svg>
);

export default App;

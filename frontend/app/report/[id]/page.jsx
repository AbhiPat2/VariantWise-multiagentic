"use client";

import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { ArrowLeft, Download, Gauge, Shield, Armchair, Wallet } from 'lucide-react';
import Link from 'next/link';

const API_BASE_URL = "http://127.0.0.1:8000";

export default function CarReport({ params }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reportRef = useRef(null);
  
  // Decode the car variant from the URL and restore spaces
  const variant = decodeURIComponent(params.id).replace(/-/g, ' ');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        console.log('Fetching report for variant:', variant);
        const res = await axios.post(`${API_BASE_URL}/api/generate_report`, {
          variant: variant
        });
        console.log('Report data received:', res.data);
        setData(res.data);
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(err.response?.data?.error || "Could not generate report. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (variant) {
      fetchReport();
    } else {
      setError("No variant specified");
      setLoading(false);
    }
  }, [variant]);

  const handleDownload = async () => {
    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Select the content to capture (everything inside the max-w-4xl container)
    const element = document.getElementById('report-content');
    
    const opt = {
      margin:       [10, 10],
      filename:     `${variant}_Report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true }, 
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600 animate-pulse">
          Generating Deep Dive Report...
        </h2>
        <p className="text-gray-400 mt-2">Analyzing specs, calculating scores, and writing review.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">Unable to Generate Report</h2>
            <p className="text-gray-400 mb-1">{error || "Car not found"}</p>
            <p className="text-sm text-gray-500">Variant: {variant}</p>
          </div>
          <div className="space-y-3">
            <Link 
              href="/dashboard" 
              className="block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Return to Dashboard
            </Link>
            <Link 
              href="/consultant" 
              className="block text-blue-400 hover:text-blue-300 transition-colors"
            >
              Go to Consultant
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { specs, report } = data;

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* Navbar */}
      <div className="p-4 flex justify-between items-center border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur z-10">
        <Link href="/consultant" className="flex items-center text-gray-300 hover:text-white">
          <ArrowLeft size={20} className="mr-2" /> Back
        </Link>
        <button 
          onClick={handleDownload}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all"
        >
          <Download size={18} className="mr-2" /> Download Report
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4" ref={reportRef} id="report-content">
        
        {/* Hero Section */}
        <div className="py-10 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500">
            {specs.variant}
          </h1>
          <p className="text-xl text-blue-400 font-medium italic">"{report.headline}"</p>
          <div className="flex justify-center gap-4 mt-6">
             <span className="bg-gray-800 px-4 py-1 rounded-full text-sm">{specs['Fuel Type']}</span>
             <span className="bg-gray-800 px-4 py-1 rounded-full text-sm">{specs['Transmission Type']}</span>
             <span className="bg-gray-800 px-4 py-1 rounded-full text-sm">{specs['price']}</span>
          </div>
        </div>

        {/* Car Image Placeholder - Replaced 3D box with Image Search Logic */}
        <div className="relative group perspective-1000 mb-16 overflow-hidden rounded-2xl border border-gray-700 shadow-[0_0_50px_rgba(59,130,246,0.3)]">
          <div className="w-full h-64 md:h-96 bg-gray-900 flex items-center justify-center relative">
             {/* Use the specific image from backend, fallback to Unsplash if missing */}
             <img 
               src={data.image_url || `https://source.unsplash.com/1600x900/?${encodeURIComponent(specs.variant.split(' ')[0] + ' car')}`} 
               alt={specs.variant}
               className="w-full h-full object-cover transform transition-transform duration-700 hover:scale-110"
               onError={(e) => {
                 e.target.onerror = null;
                 e.target.src = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80"; // Fallback luxury car
               }}
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
             {/* Show source credit if from Wikipedia */}
             {data.image_url && data.image_url.includes('wikimedia') && (
               <div className="absolute bottom-4 left-4 text-white/50 text-xs">
                 Image source: Wikimedia Commons
               </div>
             )}
          </div>
        </div>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          <ScoreCard icon={<Gauge/>} label="Performance" score={report.scores.Performance} color="text-red-400" bar="bg-red-500" />
          <ScoreCard icon={<Armchair/>} label="Comfort" score={report.scores.Comfort} color="text-yellow-400" bar="bg-yellow-500" />
          <ScoreCard icon={<Shield/>} label="Features" score={report.scores.Features} color="text-blue-400" bar="bg-blue-500" />
          <ScoreCard icon={<Wallet/>} label="Value" score={report.scores.Value} color="text-green-400" bar="bg-green-500" />
        </div>

        {/* Executive Summary */}
        <div className="bg-gray-900/50 p-8 rounded-2xl border border-gray-800 mb-12">
          <h3 className="text-2xl font-bold mb-4 flex items-center">
            <span className="w-1 h-8 bg-blue-500 mr-4 rounded-full"></span>
            Executive Summary
          </h3>
          <p className="text-lg text-gray-300 leading-relaxed">{report.summary}</p>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-12 mb-16">
          {report.sections.map((section, idx) => (
            <div key={idx} className="border-l-2 border-gray-800 pl-6 hover:border-blue-500 transition-colors duration-300">
              <h3 className="text-xl font-bold mb-3 text-white">{section.title}</h3>
              <p className="text-gray-400 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-8 rounded-2xl border border-blue-500/30 text-center mb-20">
          <h3 className="text-3xl font-bold mb-4">The Verdict</h3>
          <p className="text-xl text-gray-200">{report.verdict}</p>
        </div>

      </div>
    </div>
  );
}

function ScoreCard({ icon, label, score, color, bar }) {
  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        {icon}
        <span className="font-bold">{label}</span>
      </div>
      <div className="flex items-end gap-1 mb-2">
        <span className="text-3xl font-black">{score}</span>
        <span className="text-gray-500 text-sm mb-1">/100</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${score}%` }}></div>
      </div>
    </div>
  );
}
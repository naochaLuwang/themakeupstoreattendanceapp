'use client';
import { useState, useEffect } from 'react';
import { MapPin, Navigation, Map, AlertTriangle, ShieldCheck, Calendar as CalendarIcon, ChevronRight } from 'lucide-react';

export default function GeotagAnalysisClient({ records, selectedDate }: { records: any[], selectedDate: string }) {
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const [dateVal, setDateVal] = useState(selectedDate);

    useEffect(() => {
        setDateVal(selectedDate);
        setSelectedRecord(null); // Clear selection on new date
    }, [selectedDate]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = e.target.value;
        if (newDate) {
            setDateVal(newDate);
            // Hard refresh to ensure Next.js 15 server component picks up the new searchParams
            window.location.href = `/admin/reports/geotag?date=${newDate}`;
        }
    };

    // Filter down to records that actually have location data hooked
    const mappedRecords = records.filter(r => r.check_in_lat && r.check_in_lng);

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-8 gap-6 pb-32">
            {/* Top Bar / Filters Segment (Always at top, high visibility) */}
            <div className="lg:col-span-3 flex flex-col sm:flex-row items-center justify-between bg-white p-5 lg:p-6 rounded-[2rem] border-[3px] border-slate-100 shadow-sm transition-all drop-shadow-sm sticky top-0 lg:top-4 z-50">
                <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center shrink-0 shadow-inner">
                        <CalendarIcon size={20} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest leading-none mb-1">Audit Date</h2>
                        <p className="text-[10px] font-bold text-slate-400 leading-none">Select reporting day parameter</p>
                    </div>
                </div>
                
                <div className="relative overflow-hidden w-full sm:w-auto sm:min-w-[240px] border-2 border-slate-200 rounded-2xl bg-white focus-within:ring-4 ring-indigo-500/20 focus-within:border-indigo-500 transition-all flex items-center group shadow-sm">
                    <input 
                        type="date" 
                        name="targetDate"
                        id="targetDate"
                        value={dateVal}
                        onChange={handleDateChange}
                        className="bg-transparent border-none text-sm font-black uppercase tracking-wider w-full py-4 px-6 outline-none text-slate-700 cursor-pointer text-center sm:text-left h-14" 
                    />
                    <div className="absolute right-4 pointer-events-none text-slate-300 sm:block hidden">
                        <ChevronRight size={18} />
                    </div>
                </div>
            </div>

            {/* Geographic Mapper */}
            <div id="geotag-map" className="order-1 lg:order-2 lg:col-span-2 relative h-[50vh] min-h-[400px] lg:h-auto lg:min-h-[600px] rounded-[2rem] lg:rounded-[3rem] overflow-hidden border-2 border-slate-100 shadow-xl lg:shadow-2xl bg-slate-50 flex items-center justify-center transition-all">
                {selectedRecord ? (
                    <div className="absolute inset-0 w-full h-full bg-slate-100">
                        {/* OpenStreetMap Native Embedded View using bounding boxes */}
                        <iframe 
                            width="100%" 
                            height="100%" 
                            frameBorder="0" 
                            scrolling="no" 
                            marginHeight={0} 
                            marginWidth={0} 
                            title="Geotag Map"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedRecord.check_in_lng - 0.005},${selectedRecord.check_in_lat - 0.005},${selectedRecord.check_in_lng + 0.005},${selectedRecord.check_in_lat + 0.005}&layer=mapnik&marker=${selectedRecord.check_in_lat},${selectedRecord.check_in_lng}`}
                            className="w-full h-full"
                        />

                        {/* Store Info Overlay */}
                        <div className="absolute top-4 lg:top-6 left-4 lg:left-6 right-4 lg:right-6 flex items-center justify-between pointer-events-none">
                            <div className="bg-white/95 backdrop-blur-md px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl shadow-xl flex items-center gap-3 lg:gap-4 max-w-[90%] lg:max-w-full">
                                <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full flex shrink-0 items-center justify-center border-2 ${selectedRecord.is_within_geofence ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    <Navigation size={16} className="rotate-45" />
                                </div>
                                <div className="min-w-0 pr-2">
                                    <p className="text-xs lg:text-sm font-black text-slate-900 leading-tight truncate">
                                        {selectedRecord.is_within_geofence ? 'Verified Within Range' : 'Geofence Breach'}
                                    </p>
                                    <p className="text-[9px] lg:text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 lg:mt-1 truncate">
                                        Radius Set: {selectedRecord.stores?.radius_meters}m • {selectedRecord.stores?.name}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Cross Platform Link */}
                        <div className="absolute bottom-4 lg:bottom-6 right-4 lg:right-6">
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.check_in_lat},${selectedRecord.check_in_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-600 text-white px-4 lg:px-6 py-3 lg:py-4 rounded-xl lg:rounded-2xl text-[9px] lg:text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2 pointer-events-auto"
                            >
                                <span className="hidden sm:inline">Open in</span> Google Maps <MapPin size={12} />
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-8 lg:p-12 space-y-4">
                        <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-slate-200">
                            <MapPin size={32} className="lg:w-10 lg:h-10" />
                        </div>
                        <h3 className="text-lg lg:text-xl font-black text-slate-300 tracking-tight">Select a Transmission</h3>
                        <p className="text-[10px] lg:text-xs font-bold text-slate-400 max-w-[200px] lg:max-w-xs mx-auto">
                            Click on any employee clock-in record below to natively render their spatial coordinates.
                        </p>
                    </div>
                )}
            </div>

            {/* Data Selection Grid */}
            <div className="order-2 lg:order-1 lg:col-span-1 flex flex-col space-y-4 lg:h-full">
                <div className="flex flex-row items-center justify-between px-2 pt-2 gap-3">
                    <h2 className="text-[10px] lg:text-xs font-black uppercase tracking-widest text-slate-400 shrink-0 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Live Transmissions ({mappedRecords.length})
                    </h2>
                </div>
                
                <div className="flex flex-col gap-3 flex-1 overflow-visible pr-1 custom-scrollbar lg:h-auto lg:min-h-[400px]">
                    {mappedRecords.map(rec => {
                        const isSelected = selectedRecord?.id === rec.id;
                        return (
                            <button 
                                key={rec.id}
                                onClick={() => {
                                    setSelectedRecord(rec);
                                    if (window.innerWidth < 1024) {
                                        document.getElementById('geotag-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                }}
                                className={`w-full text-left p-4 lg:p-5 rounded-[1.5rem] lg:rounded-3xl border-[3px] transition-all shrink-0 ${
                                    isSelected 
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-100' 
                                    : 'bg-white border-slate-100/60 hover:border-slate-300 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className={`font-black text-sm lg:text-base tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                            {rec.profiles?.full_name}
                                        </p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                                            {new Intl.DateTimeFormat('en-IN', {
                                                timeZone: 'Asia/Kolkata',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: true
                                            }).format(new Date(rec.check_in))}
                                        </p>
                                    </div>
                                    <div className={`p-2 rounded-xl shrink-0 ${
                                        rec.is_within_geofence 
                                        ? (isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                                        : (isSelected ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600')
                                    }`}>
                                        {rec.is_within_geofence ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                                    </div>
                                </div>

                                <div className={`flex items-center gap-2 text-[10px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                    <MapPin size={10} className="shrink-0" />
                                    <span className="truncate">{rec.check_in_lat.toFixed(6)}, {rec.check_in_lng.toFixed(6)}</span>
                                </div>
                            </button>
                        );
                    })}

                    {mappedRecords.length === 0 && (
                        <div className="p-8 lg:p-12 text-center bg-white border border-slate-100 rounded-[1.5rem] lg:rounded-3xl">
                            <Map className="w-8 h-8 mx-auto text-slate-200 mb-3" />
                            <p className="text-sm font-black text-slate-400 tracking-tight">No spatial records {dateVal === selectedDate ? 'today' : 'on selected date'}.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Safe Area Padding for Mobile Nav */}
            <div className="h-20 lg:hidden" />
        </div>
    );
}

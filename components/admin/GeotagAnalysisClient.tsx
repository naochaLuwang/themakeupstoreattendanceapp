'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Navigation, Map, AlertTriangle, ShieldCheck, Calendar as CalendarIcon } from 'lucide-react';

export default function GeotagAnalysisClient({ records, selectedDate }: { records: any[], selectedDate: string }) {
    const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
    const router = useRouter();

    // Filter down to records that actually have location data hooked
    const mappedRecords = records.filter(r => r.check_in_lat && r.check_in_lng);

    // The store's primary location
    const defaultStore = records[0]?.stores;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Split A: Data Selection Grid */}
            <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4 pl-2 pr-2">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clock-In Transmissions ({mappedRecords.length})</h2>
                    {/* Time-Travel Calendar Input targeting Server Query */}
                    <div className="relative overflow-hidden w-32 border border-slate-200 rounded-xl bg-white focus-within:ring-2 ring-indigo-500 transition-all flex items-center shadow-sm">
                        <div className="pl-3 pointer-events-none text-slate-400"><CalendarIcon size={14} /></div>
                        <input 
                            type="date" 
                            name="targetDate"
                            id="targetDate"
                            value={selectedDate}
                            onChange={(e) => router.push(`/admin/reports/geotag?date=${e.target.value}`)}
                            className="bg-transparent border-none text-[10px] font-black uppercase w-full py-2 pr-3 outline-none text-slate-600 cursor-pointer" 
                        />
                    </div>
                </div>
                
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[400px]">
                    {mappedRecords.map(rec => {
                        const isSelected = selectedRecord?.id === rec.id;
                        return (
                            <button 
                                key={rec.id}
                                onClick={() => setSelectedRecord(rec)}
                                className={`w-full text-left p-5 rounded-3xl border transition-all ${
                                    isSelected 
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200 ring-4 ring-slate-100' 
                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md'
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className={`font-black tracking-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                                            {rec.profiles?.full_name}
                                        </p>
                                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                                            {new Date(rec.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className={`p-2 rounded-xl ${
                                        rec.is_within_geofence 
                                        ? (isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') 
                                        : (isSelected ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600')
                                    }`}>
                                        {rec.is_within_geofence ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                                    </div>
                                </div>

                                <div className={`flex items-center gap-2 text-[10px] font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                    <MapPin size={10} />
                                    <span className="truncate">{rec.check_in_lat.toFixed(6)}, {rec.check_in_lng.toFixed(6)}</span>
                                </div>
                            </button>
                        );
                    })}

                    {mappedRecords.length === 0 && (
                        <div className="p-12 text-center bg-white border border-slate-100 rounded-3xl">
                            <Map className="w-8 h-8 mx-auto text-slate-200 mb-3" />
                            <p className="text-sm font-black text-slate-400 tracking-tight">No spatial records today.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Split B: Geographic Mapper */}
            <div className="lg:col-span-2 relative h-[600px] lg:h-auto rounded-[3rem] overflow-hidden border-2 border-slate-100 shadow-2xl bg-slate-50 flex items-center justify-center">
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
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedRecord.check_in_lng - 0.005},${selectedRecord.check_in_lat - 0.005},${selectedRecord.check_in_lng + 0.005},${selectedRecord.check_in_lat + 0.005}&layer=mapnik&marker=${selectedRecord.check_in_lat},${selectedRecord.check_in_lng}`}
                            className="w-full h-full"
                        />

                        {/* Store Info Overlay */}
                        <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none">
                            <div className="bg-white/90 backdrop-blur-md px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${selectedRecord.is_within_geofence ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    <Navigation size={18} className="rotate-45" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 leading-tight">
                                        {selectedRecord.is_within_geofence ? 'Verified Within Range' : 'Geofence Breach'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                        Radius Set: {selectedRecord.stores?.radius_meters}m • {selectedRecord.stores?.name}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Cross Platform Link */}
                        <div className="absolute bottom-6 right-6">
                            <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${selectedRecord.check_in_lat},${selectedRecord.check_in_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                Open in Google Maps <MapPin size={12} />
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-12 space-y-4">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-slate-200">
                            <MapPin size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-300 tracking-tight">Select a Transmission</h3>
                        <p className="text-xs font-bold text-slate-400 max-w-xs mx-auto">
                            Click on any employee clock-in record from the left grid to natively render their spatial coordinates.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

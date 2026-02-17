'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function PresetManager() {
    const supabase = createClient();
    const [presets, setPresets] = useState<any[]>([]);
    const [label, setLabel] = useState('');
    const [start, setStart] = useState('10:00');
    const [end, setEnd] = useState('18:00');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPresets();
    }, []);

    const fetchPresets = async () => {
        const { data } = await supabase.from('shift_presets').select('*').order('created_at', { ascending: true });
        setPresets(data || []);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!label) return;
        setLoading(true);

        const { error } = await supabase.from('shift_presets').insert([
            { label, start_time: start, end_time: end }
        ]);

        if (error) alert(error.message);
        else {
            setLabel('');
            fetchPresets();
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('shift_presets').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchPresets();
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Shift Library</h3>
            </div>

            <div className="p-4">
                {/* Compact Form */}
                <form onSubmit={handleAdd} className="space-y-3 mb-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Preset Label</label>
                        <input
                            type="text"
                            placeholder="e.g. Morning Shift"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-900 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Start</label>
                            <input
                                type="time"
                                value={start}
                                onChange={(e) => setStart(e.target.value)}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">End</label>
                            <input
                                type="time"
                                value={end}
                                onChange={(e) => setEnd(e.target.value)}
                                className="w-full px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading || !label}
                        className="w-full bg-slate-900 text-white text-[10px] font-black uppercase py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-20 active:scale-[0.98]"
                    >
                        {loading ? 'Saving...' : 'Add to Library'}
                    </button>
                </form>

                {/* Compact List */}
                <div className="space-y-2">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Active Presets</label>
                    <div className="grid grid-cols-1 gap-2">
                        {presets.length === 0 && (
                            <p className="text-[10px] text-slate-400 italic py-2 text-center border border-dashed border-slate-100 rounded-lg">No presets defined</p>
                        )}
                        {presets.map((p) => (
                            <div
                                key={p.id}
                                className="group flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-300 transition-all"
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-900 uppercase leading-tight">{p.label}</span>
                                    <span className="text-[9px] font-medium text-slate-500">{p.start_time.slice(0, 5)} — {p.end_time.slice(0, 5)}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(p.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
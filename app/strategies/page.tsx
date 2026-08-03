'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, StrategyItem, RuleGroup } from '@/lib/db';
import ColorGridPicker from '@/components/ColorGridPicker';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  BookOpen, 
  GripVertical, 
  X, 
  Sparkles,
  Tag,
  AlertTriangle,
  Layers
} from 'lucide-react';

export default function StrategiesAndTagsPage() {
  const [activeTab, setActiveTab] = useState<'strategies' | 'setups' | 'mistakes'>('strategies');

  // Database Queries
  const strategies = useLiveQuery(() => db.strategies.toArray()) || [];
  const setups = useLiveQuery(() => db.setups.toArray()) || [];
  const mistakes = useLiveQuery(() => db.mistakes.toArray()) || [];

  // Strategy Modal State
  const [isStratModalOpen, setIsStratModalOpen] = useState(false);
  const [editingStratId, setEditingStratId] = useState<number | null>(null);
  const [stratName, setStratName] = useState('');
  const [stratDesc, setStratDesc] = useState('');
  const [stratColor, setStratColor] = useState('#ec3044');
  const [ruleGroups, setRuleGroups] = useState<RuleGroup[]>([
    {
      id: 'group_1',
      title: 'Entry Criteria',
      rules: [
        { id: 'rule_1', text: 'Trading above / below session VWAP', condition: 'Always' },
        { id: 'rule_2', text: 'Clean 15m Fair Value Gap rejection', condition: 'Always' }
      ]
    }
  ]);

  // Setup / Mistake Tag Modal State
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagType, setTagType] = useState<'setup' | 'mistake'>('setup');
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [tagName, setTagName] = useState('');

  // Reset Strategy Form
  const resetStratForm = () => {
    setStratName('');
    setStratDesc('');
    setStratColor('#ec3044');
    setEditingStratId(null);
    setRuleGroups([
      {
        id: 'group_1',
        title: 'Entry Criteria',
        rules: [{ id: 'rule_1', text: '', condition: 'Always' }]
      }
    ]);
  };

  // Open New Strategy
  const handleOpenNewStrat = () => {
    resetStratForm();
    setIsStratModalOpen(true);
  };

  // Open Edit Strategy
  const handleOpenEditStrat = (strat: StrategyItem) => {
    setEditingStratId(strat.id || null);
    setStratName(strat.name);
    setStratDesc(strat.description || '');
    setStratColor(strat.color || '#ec3044');
    setRuleGroups(strat.ruleGroups && strat.ruleGroups.length > 0 ? strat.ruleGroups : [
      {
        id: 'group_1',
        title: 'Entry Criteria',
        rules: [{ id: 'rule_1', text: '', condition: 'Always' }]
      }
    ]);
    setIsStratModalOpen(true);
  };

  // Open New Tag
  const handleOpenNewTag = (type: 'setup' | 'mistake') => {
    setTagType(type);
    setEditingTagId(null);
    setTagName('');
    setIsTagModalOpen(true);
  };

  // Open Edit Tag
  const handleOpenEditTag = (item: { id?: number; name: string }, type: 'setup' | 'mistake') => {
    setTagType(type);
    setEditingTagId(item.id || null);
    setTagName(item.name);
    setIsTagModalOpen(true);
  };

  // Delete Handlers
  const handleDeleteStrategy = async (id: number) => {
    if (confirm('Are you sure you want to delete this strategy?')) {
      await db.strategies.delete(id);
    }
  };

  const handleDeleteTag = async (id: number, type: 'setup' | 'mistake') => {
    if (confirm(`Are you sure you want to delete this ${type} tag?`)) {
      if (type === 'setup') await db.setups.delete(id);
      else await db.mistakes.delete(id);
    }
  };

  // Rule Group Handlers
  const handleAddRuleGroup = () => {
    setRuleGroups([...ruleGroups, {
      id: `group_${Date.now()}`,
      title: 'New Rule Group',
      rules: [{ id: `rule_${Date.now()}`, text: '', condition: 'Always' }]
    }]);
  };

  const handleRemoveRuleGroup = (groupId: string) => {
    setRuleGroups(ruleGroups.filter(g => g.id !== groupId));
  };

  const handleGroupTitleChange = (groupId: string, title: string) => {
    setRuleGroups(ruleGroups.map(g => g.id === groupId ? { ...g, title } : g));
  };

  const handleAddRule = (groupId: string) => {
    setRuleGroups(ruleGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: [...g.rules, { id: `rule_${Date.now()}`, text: '', condition: 'Always' }]
        };
      }
      return g;
    }));
  };

  const handleRemoveRule = (groupId: string, ruleId: string) => {
    setRuleGroups(ruleGroups.map(g => {
      if (g.id === groupId) {
        return { ...g, rules: g.rules.filter(r => r.id !== ruleId) };
      }
      return g;
    }));
  };

  const handleRuleTextChange = (groupId: string, ruleId: string, text: string) => {
    setRuleGroups(ruleGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.map(r => r.id === ruleId ? { ...r, text } : r)
        };
      }
      return g;
    }));
  };

  const handleRuleConditionChange = (groupId: string, ruleId: string, condition: 'Always' | 'Optional' | 'Market Context') => {
    setRuleGroups(ruleGroups.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          rules: g.rules.map(r => r.id === ruleId ? { ...r, condition } : r)
        };
      }
      return g;
    }));
  };

  // Save Handlers
  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stratName.trim()) return;

    const payload: StrategyItem = {
      name: stratName.trim(),
      description: stratDesc,
      color: stratColor,
      ruleGroups
    };

    if (editingStratId) {
      await db.strategies.update(editingStratId, payload);
    } else {
      await db.strategies.put(payload);
    }

    setIsStratModalOpen(false);
    resetStratForm();
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    if (tagType === 'setup') {
      if (editingTagId) await db.setups.update(editingTagId, { name: tagName.trim() });
      else await db.setups.put({ name: tagName.trim() });
    } else {
      if (editingTagId) await db.mistakes.update(editingTagId, { name: tagName.trim() });
      else await db.mistakes.put({ name: tagName.trim() });
    }

    setIsTagModalOpen(false);
    setTagName('');
  };

  return (
    <div className="p-8 bg-[#F8F9FD] min-h-screen text-slate-800 font-sans">
      
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#ec3044]" /> Strategies & Playbook Tags
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage strategies, entry criteria, setup confluences, and execution mistakes</p>
        </div>

        {activeTab === 'strategies' ? (
          <button 
            onClick={handleOpenNewStrat} 
            className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Strategy
          </button>
        ) : (
          <button 
            onClick={() => handleOpenNewTag(activeTab === 'setups' ? 'setup' : 'mistake')} 
            className="flex items-center gap-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New {activeTab === 'setups' ? 'Setup Tag' : 'Mistake Tag'}
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200/80 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('strategies')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'strategies' 
              ? 'border-[#ec3044] text-[#ec3044]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" /> Playbook Strategies ({strategies.length})
        </button>

        <button
          onClick={() => setActiveTab('setups')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'setups' 
              ? 'border-[#ec3044] text-[#ec3044]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" /> Setup Tags ({setups.length})
        </button>

        <button
          onClick={() => setActiveTab('mistakes')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'mistakes' 
              ? 'border-[#ec3044] text-[#ec3044]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Mistake Tags ({mistakes.length})
        </button>
      </div>

      {/* TAB 1: STRATEGIES */}
      {activeTab === 'strategies' && (
        <>
          {strategies.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
              <BookOpen className="w-12 h-12 text-[#ec3044]/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No Strategies Created Yet</h3>
              <p className="text-xs text-slate-400 mb-5">Define your playbook setups and entry criteria so you stay disciplined on every trade execution.</p>
              <button onClick={handleOpenNewStrat} className="px-4 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer">
                + Create Your First Strategy
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {strategies.map((strat) => (
                <div key={strat.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: strat.color || '#ec3044' }} />
                      <h3 className="font-extrabold text-slate-900 text-base">{strat.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenEditStrat(strat)} className="p-1 text-slate-400 hover:text-[#ec3044] rounded-lg cursor-pointer">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteStrategy(strat.id!)} className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {strat.description && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{strat.description}</p>
                  )}

                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    {strat.ruleGroups?.map((group) => (
                      <div key={group.id} className="space-y-1.5">
                        <p className="text-[10px] font-bold text-[#ec3044] uppercase tracking-wider">{group.title}</p>
                        <ul className="space-y-1">
                          {group.rules.filter(r => r.text).map((rule) => (
                            <li key={rule.id} className="text-xs text-slate-700 flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                              <span className="truncate pr-2">✓ {rule.text}</span>
                              <span className="text-[9px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border">{rule.condition}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: SETUP TAGS */}
      {activeTab === 'setups' && (
        <div>
          {setups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
              <Tag className="w-12 h-12 text-[#ec3044]/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No Setup Tags Created</h3>
              <p className="text-xs text-slate-400 mb-5">Create custom setup tags like "FVG Rejection" or "VWAP Bounce" to tag your trades.</p>
              <button onClick={() => handleOpenNewTag('setup')} className="px-4 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer">
                + Create Setup Tag
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {setups.map((s) => (
                <div key={s.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#ec3044]" />
                    <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpenEditTag(s, 'setup')} className="p-1 text-slate-400 hover:text-[#ec3044] cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteTag(s.id!, 'setup')} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MISTAKE TAGS */}
      {activeTab === 'mistakes' && (
        <div>
          {mistakes.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-sm">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900 mb-1">No Mistake Tags Created</h3>
              <p className="text-xs text-slate-400 mb-5">Track bad execution habits like "FOMO Entry" or "Chased Price" to clean up your edge.</p>
              <button onClick={() => handleOpenNewTag('mistake')} className="px-4 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer">
                + Create Mistake Tag
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mistakes.map((m) => (
                <div key={m.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-slate-800 text-xs">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleOpenEditTag(m, 'mistake')} className="p-1 text-slate-400 hover:text-[#ec3044] cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDeleteTag(m.id!, 'mistake')} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STRATEGY MODAL */}
      {isStratModalOpen && (
        <div 
          onClick={() => setIsStratModalOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-8"
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingStratId ? 'Edit Strategy & Execution Rules' : 'Create Strategy & Playbook'}
                </h3>
                <p className="text-[11px] text-slate-400">Define criteria and rule groups for this setup</p>
              </div>
              <button onClick={() => setIsStratModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-5 max-h-[75vh] overflow-y-auto pr-2">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">General info</h4>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Name</label>
                    <input 
                      type="text" 
                      value={stratName} 
                      onChange={e => setStratName(e.target.value)} 
                      placeholder="Name your trading strategy" 
                      className="w-full border border-[#ec3044]/30 bg-[#ec3044]/5 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Color Tag</label>
                    <ColorGridPicker selectedColor={stratColor} onChange={setStratColor} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Description</label>
                  <input 
                    type="text" 
                    value={stratDesc} 
                    onChange={e => setStratDesc(e.target.value)} 
                    placeholder="Add strategy description / market context..." 
                    className="w-full border border-[#ec3044]/30 bg-[#ec3044]/5 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Rules & Criteria</h4>
                    <p className="text-[10px] text-slate-400">Define when a trade should match this setup</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleAddRuleGroup} 
                    className="px-3 py-1.5 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add rule group
                  </button>
                </div>

                <div className="space-y-4">
                  {ruleGroups.map((group) => (
                    <div key={group.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <GripVertical className="w-4 h-4 text-slate-400" />
                          <input 
                            type="text" 
                            value={group.title} 
                            onChange={e => handleGroupTitleChange(group.id, e.target.value)} 
                            placeholder="E.g. Entry criteria" 
                            className="border border-slate-200 bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 w-full max-w-xs focus:outline-none"
                          />
                        </div>
                        {ruleGroups.length > 1 && (
                          <button type="button" onClick={() => handleRemoveRuleGroup(group.id)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 pl-6">
                        {group.rules.map((rule) => (
                          <div key={rule.id} className="flex items-center gap-2">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                            <input 
                              type="text" 
                              value={rule.text} 
                              onChange={e => handleRuleTextChange(group.id, rule.id, e.target.value)} 
                              placeholder="(E.g. Trading above VWAP)" 
                              className="flex-1 border border-[#ec3044]/30 bg-white rounded-lg p-2 text-xs text-[#ec3044] font-bold focus:outline-none"
                            />
                            <select 
                              value={rule.condition} 
                              onChange={e => handleRuleConditionChange(group.id, rule.id, e.target.value as any)} 
                              className="border border-slate-200 bg-white rounded-lg p-2 text-xs font-semibold text-slate-700 focus:outline-none"
                            >
                              <option value="Always">Always</option>
                              <option value="Optional">Optional</option>
                              <option value="Market Context">Market Context</option>
                            </select>
                            <button type="button" onClick={() => handleRemoveRule(group.id, rule.id)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button 
                          type="button" 
                          onClick={() => handleAddRule(group.id)} 
                          className="text-xs font-bold text-[#ec3044] hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> Add rule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsStratModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer">
                  <Sparkles className="w-4 h-4" /> Save Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETUP / MISTAKE TAG MODAL */}
      {isTagModalOpen && (
        <div 
          onClick={() => setIsTagModalOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {editingTagId ? `Edit ${tagType} Tag` : `Create New ${tagType} Tag`}
              </h3>
              <button onClick={() => setIsTagModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTag} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tag Name</label>
                <input 
                  type="text" 
                  value={tagName} 
                  onChange={e => setTagName(e.target.value)} 
                  placeholder={tagType === 'setup' ? "E.g. FVG Rejection" : "E.g. Chased Price"} 
                  className="w-full border border-[#ec3044]/30 bg-[#ec3044]/5 rounded-xl p-2.5 text-xs text-[#ec3044] font-bold focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsTagModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl text-xs shadow-md cursor-pointer">
                  Save Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
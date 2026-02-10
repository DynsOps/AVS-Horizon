
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Company } from '../../types';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { Trash2, Edit2, Plus, Building, MapPin } from 'lucide-react';

export const CompanyManagement: React.FC = () => {
    const [companies, setCompanies] = useState<Company[]>([]);
    const { addToast, openDrawer, closeDrawer } = useUIStore();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await api.admin.getCompanies();
        setCompanies(data);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this company? Associated users will lose access.')) {
            await api.admin.deleteCompany(id);
            setCompanies(companies.filter(c => c.id !== id));
            addToast({ title: 'Company Deleted', message: 'Entity removed.', type: 'info' });
        }
    };

    const handleSave = async (data: Partial<Company>, isNew: boolean) => {
        try {
            if (isNew) {
                // @ts-ignore
                const newCo = await api.admin.createCompany(data);
                setCompanies([...companies, newCo]);
                addToast({ title: 'Created', message: 'New company registered.', type: 'success' });
            } else {
                if (!data.id) return;
                const updated = await api.admin.updateCompany(data.id, data);
                setCompanies(companies.map(c => c.id === updated.id ? updated : c));
                addToast({ title: 'Updated', message: 'Company details saved.', type: 'success' });
            }
            closeDrawer();
        } catch (e) {
            addToast({ title: 'Error', message: 'Operation failed.', type: 'error' });
        }
    };

    const openCompanyDrawer = (company?: Company) => {
        openDrawer(<CompanyForm company={company} onSave={(data) => handleSave(data, !company)} onCancel={closeDrawer} />);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Entity Management</h1>
                <button 
                    onClick={() => openCompanyDrawer()}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
                >
                    <Plus size={16} strokeWidth={1.5} /> <span>Register Entity</span>
                </button>
            </div>

            <Card className="overflow-hidden" noPadding>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Company Name</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {companies.map(co => (
                            <tr key={co.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                            <Building size={16} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{co.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{co.contactEmail}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium border ${
                                        co.type === 'Customer' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' :
                                        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800'
                                    }`}>
                                        {co.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                                        <MapPin size={14} className="mr-1" /> {co.country}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                        co.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                        'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                                    }`}>
                                        {co.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button onClick={() => openCompanyDrawer(co)} className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(co.id)} className="text-red-500 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

const CompanyForm = ({ company, onSave, onCancel }: { company?: Company, onSave: (data: Partial<Company>) => void, onCancel: () => void }) => {
    const [formData, setFormData] = useState<Partial<Company>>({
        id: company?.id,
        name: company?.name || '',
        type: company?.type || 'Customer',
        country: company?.country || '',
        contactEmail: company?.contactEmail || '',
        status: company?.status || 'Active'
    });

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{company ? 'Edit Entity' : 'Register Entity'}</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company Name</label>
                    <input className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                           value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                        <select className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                            <option value="Customer">Customer</option>
                            <option value="Supplier">Supplier</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Country</label>
                    <input className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                           value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Email</label>
                    <input className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                           value={formData.contactEmail} onChange={e => setFormData({...formData, contactEmail: e.target.value})} />
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                <button onClick={() => onSave(formData)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 shadow-md">Save Entity</button>
            </div>
        </div>
    );
};

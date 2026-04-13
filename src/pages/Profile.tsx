
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { Card } from '../components/ui/Card';
import { useUIStore } from '../store/uiStore';
import { User as UserIcon, Mail, Shield, Building, Save, Loader2 } from 'lucide-react';

export const Profile: React.FC = () => {
    const { user, login } = useAuthStore();
    const { addToast } = useUIStore();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
    });
    const hasProfileChanges = formData.name.trim() !== (user?.name || '');

    const handleSave = async () => {
        if (!user) return;
        if (!formData.name.trim()) {
            addToast({ title: 'Validation Error', message: 'Full name is required.', type: 'error' });
            return;
        }
        setIsLoading(true);
        try {
            const updatedUser = await api.auth.updateProfile(user.id, { name: formData.name.trim() });
            login(updatedUser); // Update local store
            addToast({ title: 'Success', message: 'Profile updated successfully', type: 'success' });
            setIsEditing(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile.';
            addToast({ title: 'Error', message, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Profile Overview Card */}
                <Card className="col-span-1 flex flex-col items-center text-center p-8">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 p-1 mb-4 shadow-lg shadow-blue-500/30">
                        <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                            <span className="text-4xl font-bold text-slate-700 dark:text-slate-200">{user.name.charAt(0)}</span>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user.name}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{user.role}</p>
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        Status: {user.status}
                    </div>
                </Card>

                {/* Edit Details Card */}
                <Card className="col-span-1 md:col-span-2" title="Personal Information">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <UserIcon size={16} className="text-slate-400" />
                                    </div>
                                    <input 
                                        type="text" 
                                        disabled={!isEditing}
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="pl-10 w-full px-4 py-2 bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Mail size={16} className="text-slate-400" />
                                    </div>
                                    <input 
                                        type="email" 
                                        disabled
                                        value={formData.email}
                                        className="pl-10 w-full px-4 py-2 bg-gray-50 dark:bg-slate-950/50 border border-gray-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white disabled:opacity-60 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    Email is managed by Microsoft identity and cannot be edited here.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Entity ID</label>
                                    <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                                        <Building size={16} className="text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300 font-mono text-sm">{user.companyId || 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Role</label>
                                    <div className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
                                        <Shield size={16} className="text-slate-400" />
                                        <span className="text-slate-700 dark:text-slate-300 text-sm">{user.role}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-800">
                            {isEditing ? (
                                <div className="flex space-x-3">
                                    <button 
                                        onClick={() => { setIsEditing(false); setFormData({ name: user.name, email: user.email }); }}
                                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        disabled={isLoading || !hasProfileChanges}
                                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        <span>Save Changes</span>
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            <Card title="System Permissions & Security">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Active Permissions</h4>
                        <div className="flex flex-wrap gap-2">
                            {user.permissions && user.permissions.length > 0 ? user.permissions.map(perm => (
                                <span key={perm} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs font-mono border border-blue-100 dark:border-blue-800">
                                    {perm}
                                </span>
                            )) : (
                                <span className="text-sm text-slate-500 italic">No specific permissions assigned.</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Security Log</h4>
                        <div className="space-y-2">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between border-b border-gray-100 dark:border-slate-800 pb-1">
                                <span>Last Login</span>
                                <span className="font-mono">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}</span>
                            </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-sky-50 p-4 dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-sky-950/20">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">Credentials managed by Entra ID</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                Password changes, MFA enrollment, conditional access, and account recovery are handled on the Entra-hosted identity pages.
                                AVS Horizon stores only your portal profile and authorization data.
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

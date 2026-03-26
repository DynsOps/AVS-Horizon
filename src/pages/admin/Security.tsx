import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { User, UserRole } from '../../types';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { Trash2, RefreshCw, Shield, Search, Edit2, Eye, EyeOff, Copy } from 'lucide-react';

export const Security: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const { addToast, openDrawer, closeDrawer } = useUIStore();
    const { user: actor } = useAuthStore();
    const isSupAdminActor = actor?.role === 'supadmin';
    const assignableRoles: UserRole[] = isSupAdminActor ? ['user', 'admin', 'supadmin'] : ['user', 'admin'];
    const canManageTargetUser = (target: User) => isSupAdminActor || target.role !== 'supadmin';

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        const allUsers = await api.admin.getUsers();
        setUsers(allUsers);
    };

    const handleDelete = async (id: string) => {
        const targetUser = users.find((u) => u.id === id);
        if (targetUser && !canManageTargetUser(targetUser)) {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can delete a supadmin identity user.', type: 'error' });
            return;
        }
        if (!confirm('Are you sure you want to delete this identity user?')) return;
        await api.admin.deleteUser(id);
        await loadUsers();
        addToast({
            title: 'User Deleted',
            message: 'User has been deleted from identity records.',
            type: 'info',
        });
    };

    const openEditDrawer = (user: User) => {
        if (!canManageTargetUser(user)) {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can edit supadmin identity users.', type: 'error' });
            return;
        }
        openDrawer(
            <IdentityUserForm
                user={user}
                assignableRoles={assignableRoles}
                onCancel={closeDrawer}
                onSave={async (updates) => {
                    try {
                        if (!isSupAdminActor && updates.role === 'supadmin') {
                            throw new Error('Only supadmin can assign supadmin role.');
                        }
                        await api.admin.updateUser(user.id, updates);
                        await loadUsers();
                        addToast({ title: 'User Updated', message: 'Identity record updated successfully.', type: 'success' });
                        closeDrawer();
                    } catch (error) {
                        const message = error instanceof Error ? error.message : 'Failed to update identity record.';
                        addToast({ title: 'Error', message, type: 'error' });
                    }
                }}
            />
        );
    };

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const q = searchTerm.trim().toLowerCase();
            const matchesSearch = q.length === 0 ||
                user.name.toLowerCase().includes(q) ||
                user.email.toLowerCase().includes(q) ||
                (user.companyId || '').toLowerCase().includes(q);
            return matchesRole && matchesSearch;
        });
    }, [users, roleFilter, searchTerm]);

    const togglePasswordVisibility = (userId: string) => {
        setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Identity Management</h1>
                <button
                    onClick={loadUsers}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800 transition-colors"
                >
                    <RefreshCw size={16} strokeWidth={1.5} /> <span className="text-sm font-medium">Sync Entra ID</span>
                </button>
            </div>

            <Card className="overflow-hidden" noPadding>
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900">
                    <div className="flex items-center space-x-2 min-w-0">
                        <Shield size={16} className="text-slate-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 uppercase tracking-wide">Identity Users</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search name/email/entity..."
                                className="pl-8 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
                            className="px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
                        >
                            <option value="all">all roles</option>
                            <option value="supadmin">supadmin</option>
                            <option value="admin">admin</option>
                            <option value="user">user</option>
                        </select>
                    </div>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Entity ID</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Temporary Password</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Power BI Access</th>
                            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors even:bg-slate-50/30 dark:even:bg-slate-900/30">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs mr-3 border border-slate-200 dark:border-slate-700">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{user.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className={`w-fit px-2 py-1 rounded-full text-xs font-medium border ${
                                            user.role === 'supadmin' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800' :
                                            user.role === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' :
                                            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800'
                                        }`}>
                                            {user.role}
                                        </span>
                                        {user.role === 'user' && (user.permissions.includes('manage:users') || user.permissions.includes('manage:companies')) && (
                                            <span className="w-fit rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                Company Admin
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">{user.companyId || 'N/A'}</td>
                                <td className="px-6 py-4">
                                    {user.temporaryPassword ? (
                                        <div className="flex items-center gap-2">
                                            <code className="rounded border border-amber-200/70 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-300">
                                                {visiblePasswords[user.id] ? user.temporaryPassword : '••••••••••'}
                                            </code>
                                            <button
                                                onClick={() => togglePasswordVisibility(user.id)}
                                                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                title={visiblePasswords[user.id] ? 'Hide password' : 'Show password'}
                                            >
                                                {visiblePasswords[user.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(user.temporaryPassword || '');
                                                        addToast({ title: 'Copied', message: 'Temporary password copied.', type: 'success' });
                                                    } catch {
                                                        addToast({ title: 'Copy Failed', message: 'Clipboard access not available.', type: 'error' });
                                                    }
                                                }}
                                                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                                title="Copy password"
                                            >
                                                <Copy size={15} />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                                        (user.powerBiAccess || 'none') === 'editor'
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                                            : (user.powerBiAccess || 'none') === 'viewer'
                                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800'
                                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    }`}>
                                        {user.powerBiAccess || 'none'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                     <div className="flex items-center">
                                         <div className="h-2 w-2 rounded-full bg-green-500 mr-2 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                         <span className="text-sm text-slate-600 dark:text-slate-300">Active</span>
                                     </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => openEditDrawer(user)}
                                        className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can edit supadmin users' : 'Edit user'}
                                    >
                                        <Edit2 size={16} strokeWidth={1.5} />
                                    </button>
                                    <button 
                                        onClick={() => void handleDelete(user.id)}
                                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can delete supadmin users' : 'Delete user'}
                                    >
                                        <Trash2 size={16} strokeWidth={1.5} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
};

const IdentityUserForm = ({
    user,
    assignableRoles,
    onSave,
    onCancel,
}: {
    user: User,
    assignableRoles: UserRole[],
    onSave: (updates: Partial<User>) => Promise<void>,
    onCancel: () => void,
}) => {
    const [formData, setFormData] = useState<Partial<User>>({
        name: user.name,
        role: user.role,
        status: user.status,
        companyId: user.companyId || '',
        isGuest: user.isGuest || false,
        powerBiAccess: user.powerBiAccess || 'none',
        powerBiWorkspaceId: user.powerBiWorkspaceId || '',
        powerBiReportId: user.powerBiReportId || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const save = async () => {
        if (formData.role === 'user' && !formData.isGuest && !formData.companyId?.trim()) {
            return;
        }
        setIsSaving(true);
        try {
            await onSave(formData);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Identity User</h2>
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
                    <input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                    <input
                        value={user.email}
                        disabled
                        className="w-full p-2 bg-gray-100 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-500"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => {
                                const role = e.target.value as UserRole;
                                setFormData({
                                    ...formData,
                                    role,
                                    isGuest: role === 'user' ? formData.isGuest : false,
                                    companyId: role === 'user' && !formData.isGuest ? formData.companyId : '',
                                    powerBiAccess: role === 'user' ? (formData.isGuest ? 'none' : (formData.powerBiAccess || 'viewer')) : (formData.powerBiAccess || 'editor'),
                                });
                            }}
                            className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        >
                            {assignableRoles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as User['status'] })}
                            className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        <input
                            type="checkbox"
                            checked={!!formData.isGuest}
                            disabled={formData.role !== 'user'}
                            onChange={(e) => setFormData({ ...formData, isGuest: e.target.checked, companyId: e.target.checked ? '' : formData.companyId })}
                        />
                        Guest user (Global)
                    </label>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entity ID</label>
                    <input
                        value={formData.companyId || ''}
                        onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                        disabled={formData.role !== 'user' || !!formData.isGuest}
                        placeholder={formData.role === 'user' ? (formData.isGuest ? 'N/A for guest user' : 'C-001') : 'N/A for admin roles'}
                        className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white disabled:opacity-60"
                    />
                    {formData.role === 'user' && !formData.isGuest && !formData.companyId?.trim() && (
                        <p className="mt-1 text-[11px] text-red-500">Entity ID is required for user role.</p>
                    )}
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Power BI Access Management</p>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Access</label>
                            <select
                                value={formData.powerBiAccess}
                                onChange={(e) => {
                                    const access = e.target.value as User['powerBiAccess'];
                                    setFormData({
                                        ...formData,
                                        powerBiAccess: access,
                                        powerBiWorkspaceId: access === 'none' ? '' : formData.powerBiWorkspaceId,
                                        powerBiReportId: access === 'none' ? '' : formData.powerBiReportId,
                                    });
                                }}
                                className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                            >
                                <option value="none">none</option>
                                <option value="viewer">viewer</option>
                                <option value="editor">editor</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Workspace ID</label>
                            <input
                                value={formData.powerBiWorkspaceId || ''}
                                disabled={formData.powerBiAccess === 'none'}
                                onChange={(e) => setFormData({ ...formData, powerBiWorkspaceId: e.target.value })}
                                className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Report ID</label>
                            <input
                                value={formData.powerBiReportId || ''}
                                disabled={formData.powerBiAccess === 'none'}
                                onChange={(e) => setFormData({ ...formData, powerBiReportId: e.target.value })}
                                className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white disabled:opacity-60"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    Cancel
                </button>
                <button
                    onClick={() => void save()}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-70"
                >
                    {isSaving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
};

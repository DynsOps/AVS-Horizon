
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, Permission, UserRole, Company, AnalysisReport } from '../../types';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { Trash2, Edit2, Plus, Check, Search, KeyRound, Copy, Eye, EyeOff, X, Lock } from 'lucide-react';
import { getDefaultPermissionsForRole } from '../../utils/rbac';

const BASE_PERMISSIONS: Permission[] = [
    'view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'view:supplier',
    'create:support-ticket', 'submit:rfq',
    'manage:users', 'manage:companies', 'manage:reports', 'view:finance', 'view:sustainability', 'view:business', 'edit:orders', 'view:analytics', 'system:settings'
];
const ADMIN_CORE_PERMISSIONS: Permission[] = ['view:dashboard', 'view:reports', 'manage:users', 'view:analytics'];
const SUPADMIN_CONTROLLED_PERMISSIONS: Permission[] = ['system:settings', 'view:finance', 'view:sustainability', 'view:business', 'manage:reports'];

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [analysisReports, setAnalysisReports] = useState<AnalysisReport[]>([]);
    const { addToast, openDrawer, closeDrawer, openConfirmDialog } = useUIStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [newUserCredentials, setNewUserCredentials] = useState<{ email: string; temporaryPassword: string } | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [showNewCredentialPassword, setShowNewCredentialPassword] = useState(false);
    const { user: actor } = useAuthStore();
    const isSupAdminActor = actor?.role === 'supadmin';
    const isCoreAdminActor = actor?.role === 'admin' && Boolean(actor?.showOnlyCoreAdminPermissions);
    const assignableRoles: UserRole[] = isSupAdminActor ? ['user', 'admin', 'supadmin'] : (isCoreAdminActor ? ['user'] : ['user', 'admin']);
    const canManageTargetUser = (target: User) => isSupAdminActor || target.role !== 'supadmin';
    const analysisReportPermissions = analysisReports.map((report) => report.permissionKey);
    const allPermissions = [...BASE_PERMISSIONS, ...analysisReportPermissions];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [u, c, reports] = await Promise.all([api.admin.getUsers(), api.admin.getCompanies(), api.admin.getAnalysisReports()]);
            setUsers(u);
            setCompanies(c);
            setAnalysisReports(reports);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load users/entities.';
            addToast({ title: 'Data Load Error', message, type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        const targetUser = users.find((u) => u.id === id);
        if (targetUser && !canManageTargetUser(targetUser)) {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can delete a supadmin user.', type: 'error' });
            return;
        }
        const confirmed = await openConfirmDialog({
            title: 'Delete User',
            message: 'Are you sure you want to delete this user?',
            confirmLabel: 'Delete',
            tone: 'danger',
        });
        if (!confirmed) return;
        await api.admin.deleteUser(id);
        await loadData();
        addToast({ title: 'User Deleted', message: 'User removed successfully.', type: 'info' });
    };

    const handleSaveUser = async (userData: Partial<User>, isNew: boolean) => {
        const normalizedEmail = userData.email?.trim().toLowerCase();
        if (!userData.name?.trim()) {
            addToast({ title: 'Validation Error', message: 'Full name is required.', type: 'error' });
            return;
        }
        if (!normalizedEmail) {
            addToast({ title: 'Validation Error', message: 'Email is required.', type: 'error' });
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            addToast({ title: 'Validation Error', message: 'Please enter a valid email address.', type: 'error' });
            return;
        }
        if (!userData.role) {
            addToast({ title: 'Validation Error', message: 'Role is required.', type: 'error' });
            return;
        }
        if (!isSupAdminActor && userData.role === 'supadmin') {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can assign supadmin role.', type: 'error' });
            return;
        }
        if (!isNew && userData.id) {
            const existingUser = users.find((u) => u.id === userData.id);
            if (existingUser && !canManageTargetUser(existingUser)) {
                addToast({ title: 'Permission Denied', message: 'Only supadmin can edit a supadmin user.', type: 'error' });
                return;
            }
        }
        const companyRequired = (userData.role === 'user' && !userData.isGuest) || userData.role === 'admin';
        if (companyRequired && !userData.companyId) {
            addToast({ title: 'Validation Error', message: 'Company is required for role "user" (non-guest) and "admin".', type: 'error' });
            return;
        }
        const hasCompanyAdminPermissions = Boolean(userData.permissions?.includes('manage:users') || userData.permissions?.includes('manage:companies'));
        if (userData.role === 'user' && hasCompanyAdminPermissions && (!userData.companyId || userData.isGuest)) {
            addToast({ title: 'Validation Error', message: 'Company Admin users must be non-guest and linked to a company.', type: 'error' });
            return;
        }

        try {
            if (isNew) {
                const duplicateExists = users.some(u => u.email.toLowerCase() === normalizedEmail);
                if (duplicateExists) {
                    addToast({ title: 'Duplicate Email', message: 'A user with this email already exists.', type: 'error' });
                    return;
                }
                // @ts-ignore - id generated by api
                const { user: newUser, temporaryPassword } = await api.admin.createUser({
                    ...userData,
                    email: normalizedEmail,
                } as Omit<User, 'id'>);
                await loadData();
                setNewUserCredentials({ email: newUser.email, temporaryPassword });
                setShowNewCredentialPassword(false);
                addToast({ title: 'User Created', message: 'Temporary password generated.', type: 'success' });
            } else {
                if (!userData.id) return;
                const existingUser = users.find((u) => u.id === userData.id);
                const confirmMessage = existingUser
                    ? `Are you sure you want to update ${existingUser.email}?`
                    : 'Are you sure you want to update this user?';
                const confirmed = await openConfirmDialog({
                    title: 'Update User',
                    message: confirmMessage,
                    confirmLabel: 'Update',
                });
                if (!confirmed) return;
                await api.admin.updateUser(userData.id, { ...userData, email: normalizedEmail });
                await loadData();
                addToast({ title: 'User Updated', message: 'User details saved.', type: 'success' });
            }
            closeDrawer();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Operation failed.';
            addToast({ title: 'Error', message, type: 'error' });
        }
    };

    const openUserDrawer = (user?: User) => {
        if (user && !canManageTargetUser(user)) {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can manage supadmin users.', type: 'error' });
            return;
        }
        openDrawer(
            <UserForm
                user={user}
                companies={companies}
                assignableRoles={assignableRoles}
                isSupAdminActor={isSupAdminActor}
                isCoreAdminActor={isCoreAdminActor}
                actorPermissions={actor?.permissions || []}
                availablePermissions={allPermissions}
                analysisReports={analysisReports}
                onSave={(data) => handleSaveUser(data, !user)}
                onCancel={closeDrawer}
            />
        );
    };

    const filteredUsers = users.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const togglePasswordVisibility = (userId: string) => {
        setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
    };
    const handleResetPassword = async (target: User) => {
        if (!canManageTargetUser(target)) {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can reset supadmin passwords.', type: 'error' });
            return;
        }
        const confirmed = await openConfirmDialog({
            title: 'Reset Password',
            message: `Reset password for ${target.email}?`,
            confirmLabel: 'Reset',
        });
        if (!confirmed) return;
        try {
            const payload = await api.admin.resetUserPassword(target.id);
            await loadData();
            setNewUserCredentials({ email: payload.email, temporaryPassword: payload.temporaryPassword });
            setShowNewCredentialPassword(false);
            addToast({ title: 'Password Reset', message: 'Temporary password generated successfully.', type: 'success' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reset password.';
            addToast({ title: 'Error', message, type: 'error' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
                <button 
                    onClick={() => openUserDrawer()}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
                >
                    <Plus size={16} strokeWidth={1.5} /> <span>Add User</span>
                </button>
            </div>

            {newUserCredentials && (
                <Card className="border-amber-200/70 dark:border-amber-700/50 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                                <KeyRound size={16} className="text-amber-700 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">Temporary Password</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                    <span className="font-medium">{newUserCredentials.email}</span> için oluşturuldu. İlk girişte değiştirilmeli.
                                </p>
                                <code className="mt-2 inline-block rounded border border-amber-300/70 dark:border-amber-700/60 bg-white/70 dark:bg-slate-900 px-2 py-1 text-sm font-semibold tracking-wide text-amber-800 dark:text-amber-300">
                                    {showNewCredentialPassword ? newUserCredentials.temporaryPassword : '••••••••••'}
                                </code>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowNewCredentialPassword(prev => !prev)}
                                className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                            >
                                {showNewCredentialPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                {showNewCredentialPassword ? 'Hide Password' : 'Show Password'}
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(newUserCredentials.temporaryPassword);
                                        addToast({ title: 'Copied', message: 'Temporary password copied.', type: 'success' });
                                    } catch {
                                        addToast({ title: 'Copy Failed', message: 'Clipboard access not available.', type: 'error' });
                                    }
                                }}
                                className="flex items-center gap-2 rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                            >
                                <Copy size={14} />
                                Copy Password
                            </button>
                            <button
                                onClick={() => setNewUserCredentials(null)}
                                className="rounded-lg border border-amber-300/80 bg-white p-2 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
                                title="Dismiss"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                </Card>
            )}

            <Card className="overflow-hidden" noPadding>
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900">
                    <div className="relative w-64">
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    </div>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role & Company</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Permissions</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Temporary Password</th>
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                        {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold mr-3">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white text-sm">{user.name}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-slate-900 dark:text-slate-200">{user.role}</span>
                                        <span className="text-xs text-slate-500">{user.companyId || 'No Company'}</span>
                                        {user.role === 'user' && (user.permissions.includes('manage:users') || user.permissions.includes('manage:companies')) && (
                                            <span className="mt-1 inline-flex w-fit rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                                                Company Admin
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {user.permissions.slice(0, 3).map(p => (
                                            <span key={p} className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded border border-gray-200 dark:border-slate-700">{p}</span>
                                        ))}
                                        {user.permissions.length > 3 && <span className="text-[10px] text-slate-400">+{user.permissions.length - 3} more</span>}
                                    </div>
                                </td>
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
                                        user.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                                        'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                                    }`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button
                                        onClick={() => { void handleResetPassword(user); }}
                                        className="text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 disabled:text-slate-300 disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can reset supadmin passwords' : 'Reset password'}
                                    >
                                        <KeyRound size={16} />
                                    </button>
                                    <button
                                        onClick={() => openUserDrawer(user)}
                                        className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:text-slate-300 disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can edit supadmin users' : 'Edit user'}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(user.id)}
                                        className="text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:text-slate-300 disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can delete supadmin users' : 'Delete user'}
                                    >
                                        <Trash2 size={16} />
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

const UserForm = ({
    user,
    companies,
    assignableRoles,
    isSupAdminActor,
    isCoreAdminActor,
    actorPermissions,
    availablePermissions,
    analysisReports,
    onSave,
    onCancel,
}: {
    user?: User,
    companies: Company[],
    assignableRoles: UserRole[],
    isSupAdminActor: boolean,
    isCoreAdminActor: boolean,
    actorPermissions: Permission[],
    availablePermissions: Permission[],
    analysisReports: AnalysisReport[],
    onSave: (data: Partial<User>) => void,
    onCancel: () => void
}) => {
    const getBasicPermissionsForContext = (role: UserRole, isGuest: boolean): Permission[] => {
        if (role === 'supadmin') return getDefaultPermissionsForRole('supadmin');
        if (role === 'admin') return ADMIN_CORE_PERMISSIONS;
        if (role === 'user' && isGuest) return ['submit:rfq', 'create:support-ticket'];
        return ['view:dashboard', 'view:reports', 'create:support-ticket'];
    };

    const getAllowedBasicPermissionsForContext = (role: UserRole, isGuest: boolean): Permission[] => {
        const basic = getBasicPermissionsForContext(role, isGuest);
        if (isSupAdminActor) return basic;
        return basic.filter((permission) => actorPermissions.includes(permission));
    };

    const getDefaultFormPermissionsForRole = (role: UserRole): Permission[] => {
        return getAllowedBasicPermissionsForContext(role, false);
    };

    const inferShowOnlyAdminCore = (formUser?: User): boolean => {
        if (typeof formUser?.id === 'string') return Boolean(formUser?.showOnlyCoreAdminPermissions);
        return isCoreAdminActor;
    };

    const [formData, setFormData] = useState<Partial<User>>({
        id: user?.id,
        name: user?.name || '',
        email: user?.email || '',
        role: user?.role || 'user',
        companyId: user?.companyId || '',
        isGuest: user?.isGuest || false,
        status: user?.status || 'Active',
        permissions: user?.permissions || getAllowedBasicPermissionsForContext(user?.role || 'user', user?.isGuest || false)
    });
    const [showOnlyAdminCorePermissions, setShowOnlyAdminCorePermissions] = useState<boolean>(inferShowOnlyAdminCore(user));

    useEffect(() => {
        setFormData({
            id: user?.id,
            name: user?.name || '',
            email: user?.email || '',
            role: user?.role || 'user',
            companyId: user?.companyId || '',
            isGuest: user?.isGuest || false,
            status: user?.status || 'Active',
            permissions: user?.permissions || getAllowedBasicPermissionsForContext(user?.role || 'user', user?.isGuest || false)
        });
        setShowOnlyAdminCorePermissions(inferShowOnlyAdminCore(user));
    }, [user]);

    const togglePermission = (perm: Permission) => {
        if (!isSupAdminActor && SUPADMIN_CONTROLLED_PERMISSIONS.includes(perm)) return;
        if (!isSupAdminActor && !actorPermissions.includes(perm)) return;
        setFormData(prev => {
            const perms = prev.permissions || [];
            if (perms.includes(perm)) return { ...prev, permissions: perms.filter(p => p !== perm) };
            return { ...prev, permissions: [...perms, perm] };
        });
    };

    const isPermissionLocked = (perm: Permission): boolean => {
        const isSupadminControlled = SUPADMIN_CONTROLLED_PERMISSIONS.includes(perm);
        const actorMissing = !isSupAdminActor && !actorPermissions.includes(perm);
        return !isSupAdminActor && (isSupadminControlled || actorMissing);
    };

    const generalPermissions = availablePermissions.filter((permission) => !permission.startsWith('view:analysis-report:'));
    const visibleGeneralPermissions = generalPermissions.filter((permission) => {
        if (isSupAdminActor) return true;
        return actorPermissions.includes(permission) || Boolean((formData.permissions || []).includes(permission));
    });
    const biReportEntries = analysisReports.map((report) => ({
        id: report.id,
        name: report.name,
        permission: report.permissionKey,
    })).filter((entry) => {
        if (isSupAdminActor) return true;
        return actorPermissions.includes(entry.permission) || Boolean((formData.permissions || []).includes(entry.permission));
    });

    return (
        <>
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user ? 'Edit User' : 'Create User'}</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                    <input className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                           value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                    <input className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                           value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role</label>
                        <select className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                value={formData.role} onChange={e => {
                                    const nextRole = e.target.value as UserRole;
                                    const nextIsGuest = nextRole === 'user' ? !!formData.isGuest : false;
                                    setFormData({
                                        ...formData,
                                        role: nextRole,
                                        isGuest: nextIsGuest,
                                        companyId: nextRole === 'supadmin' ? '' : formData.companyId,
                                        permissions: getAllowedBasicPermissionsForContext(nextRole, nextIsGuest),
                                    });
                                }}>
                            {(() => {
                                const limitedRoleOptions = (!isSupAdminActor && showOnlyAdminCorePermissions)
                                    ? assignableRoles.filter((role) => role === 'user')
                                    : assignableRoles;
                                const roleOptions = (formData.role && !limitedRoleOptions.includes(formData.role))
                                    ? [...limitedRoleOptions, formData.role]
                                    : limitedRoleOptions;
                                return roleOptions.map((role) => (
                                <option key={role} value={role}>{role}</option>
                                ));
                            })()}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                                value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
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
                            onChange={(e) => {
                                const nextIsGuest = e.target.checked;
                                setFormData({
                                    ...formData,
                                    isGuest: nextIsGuest,
                                    companyId: nextIsGuest ? '' : formData.companyId,
                                    permissions: getAllowedBasicPermissionsForContext(formData.role || 'user', nextIsGuest),
                                });
                            }}
                        />
                        Guest user (Global)
                    </label>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Company</label>
                    <select className="w-full p-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
                            value={formData.companyId}
                            disabled={formData.role === 'supadmin' || (formData.role === 'user' && !!formData.isGuest)}
                            onChange={e => setFormData({...formData, companyId: e.target.value})}>
                        <option value="">-- Select Company --</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                        Company selection is required for `admin` and non-guest `user` roles.
                    </p>
                </div>

                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company Rules</p>
                    <ul className="mt-2 space-y-1">
                        <li>`supadmin`: Company not required.</li>
                        <li>`admin`: Company required. Scoped to selected company.</li>
                        <li>`user` + `Guest`: Company optional (global access as guest).</li>
                        <li>`user` + non-guest: Company required.</li>
                    </ul>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">General Permissions</label>
                    {isSupAdminActor && (
                        <div className="mb-3">
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Permission View
                            </label>
                            <select
                                value={showOnlyAdminCorePermissions ? 'core' : 'all'}
                                onChange={(e) => {
                                    const nextShowCore = e.target.value === 'core';
                                    setShowOnlyAdminCorePermissions(nextShowCore);
                                    const role = formData.role || 'user';
                                    const isGuest = role === 'user' ? !!formData.isGuest : false;
                                    setFormData((prev) => ({
                                        ...prev,
                                        permissions: getAllowedBasicPermissionsForContext(role, isGuest),
                                    }));
                                }}
                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                                <option value="all">All permissions</option>
                                <option value="core">Core admin only</option>
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        {visibleGeneralPermissions.map(p => (
                            (() => {
                                const isSupadminControlled = SUPADMIN_CONTROLLED_PERMISSIONS.includes(p);
                                const actorMissing = !isSupAdminActor && !actorPermissions.includes(p);
                                const isLocked = isPermissionLocked(p);
                                const hiddenByCoreAdminActor =
                                    !isSupAdminActor &&
                                    isCoreAdminActor &&
                                    !ADMIN_CORE_PERMISSIONS.includes(p);
                                const hideUnselectedLockedForAdmin =
                                    isSupAdminActor &&
                                    showOnlyAdminCorePermissions &&
                                    formData.role === 'admin' &&
                                    isSupadminControlled &&
                                    !(formData.permissions || []).includes(p);
                                if (hiddenByCoreAdminActor || hideUnselectedLockedForAdmin) return null;
                                return (
                            <div key={p}
                                 onClick={() => !isLocked && togglePermission(p)}
                                 title={isLocked ? (actorMissing ? 'Admin can only grant permissions they already have.' : 'Only supadmin can manage this permission.') : p}
                                 className={`${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} px-3 py-2 rounded text-xs border flex items-center justify-between transition-colors ${formData.permissions?.includes(p) ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' : 'bg-gray-50 border-gray-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'}`}>
                                <span>{p}</span>
                                <span className="flex items-center gap-1">
                                    {isLocked && <Lock size={11} />}
                                    {formData.permissions?.includes(p) && <Check size={12} />}
                                </span>
                            </div>
                                );
                            })()
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">BI Reports Access</label>
                    <div className="grid grid-cols-1 gap-2">
                        {biReportEntries.map((entry) => {
                            const isLocked = isPermissionLocked(entry.permission);
                            const selected = (formData.permissions || []).includes(entry.permission);
                            return (
                                <label
                                    key={entry.id}
                                    className={`flex items-center justify-between rounded border px-3 py-2 text-xs ${
                                        selected
                                            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                                            : 'border-gray-200 bg-gray-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                    } ${isLocked ? 'opacity-60' : ''}`}
                                    title={isLocked ? 'This BI report permission is locked for current actor.' : entry.permission}
                                >
                                    <span className="mr-3">
                                        <span className="block font-semibold">{entry.name}</span>
                                        <span className="text-[10px] opacity-80">{entry.permission}</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        disabled={isLocked}
                                        onChange={() => !isLocked && togglePermission(entry.permission)}
                                    />
                                </label>
                            );
                        })}
                        {biReportEntries.length === 0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No BI reports configured yet.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Cancel</button>
                <button
                    onClick={() => {
                        const nextData: Partial<User> = { ...formData };
                        nextData.showOnlyCoreAdminPermissions = formData.role === 'admin' ? showOnlyAdminCorePermissions : false;
                        if (showOnlyAdminCorePermissions && formData.role === 'admin') {
                            nextData.permissions = (formData.permissions || []).filter((permission) => ADMIN_CORE_PERMISSIONS.includes(permission));
                        }
                        onSave(nextData);
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 shadow-md"
                >
                    Save User
                </button>
            </div>
        </div>

        </>
    );
};

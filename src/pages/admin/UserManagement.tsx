
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, Permission, UserRole, Company, AnalysisReport, ProvisioningSource, BootstrapCredentials } from '../../types';
import { AsyncActionButton } from '../../components/ui/AsyncActionButton';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { useAuthStore } from '../../store/authStore';
import { Trash2, Edit2, Plus, Check, Search, KeyRound, Copy, Eye, EyeOff, X, Lock } from 'lucide-react';
import { getDefaultPermissionsForRole } from '../../utils/rbac';

const BASE_PERMISSIONS: Permission[] = [
    'view:dashboard', 'view:operational-list', 'view:invoices', 'view:port-fees', 'view:reports', 'view:fleet', 'view:shipments', 'view:orders', 'view:supplier',
    'create:support-ticket', 'submit:rfq',
    'manage:users', 'manage:companies', 'manage:reports', 'view:finance', 'view:sustainability', 'view:business', 'edit:orders', 'view:analytics', 'system:settings','manage:vessels','view:maritime-map'
];
const ADMIN_CORE_PERMISSIONS: Permission[] = ['view:dashboard', 'view:reports', 'manage:users', 'view:analytics'];
const COMPANY_ADMIN_BASE_PERMISSIONS: Permission[] = ['view:dashboard', 'view:reports', 'create:support-ticket'];
const COMPANY_ADMIN_HIDDEN_PERMISSIONS: Permission[] = ['manage:users', 'manage:companies'];
const SUPADMIN_CONTROLLED_PERMISSIONS: Permission[] = ['system:settings', 'view:finance', 'view:sustainability', 'view:business', 'manage:reports'];

const getProvisioningLabel = (provisioningSource?: ProvisioningSource): string => {
    switch (provisioningSource) {
        case 'bootstrap_supadmin':
            return 'Bootstrap Supadmin';
        case 'auto_domain':
            return 'Auto Domain';
        case 'external_local_account':
            return 'External Local Account';
        case 'invited_personal':
            return 'Legacy Invited Personal';
        case 'corporate_precreated':
            return 'Legacy Corporate Pre-Created';
        default:
            return 'External Local Account';
    }
};

const isCompanyAdminLikeUser = (target: Pick<User, 'role' | 'permissions'>): boolean => {
    if (target.role !== 'user') return false;
    return COMPANY_ADMIN_HIDDEN_PERMISSIONS.some((permission) => target.permissions.includes(permission));
};

const isBiReportPermission = (permission: Permission): boolean => permission.startsWith('view:analysis-report:');

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [analysisReports, setAnalysisReports] = useState<AnalysisReport[]>([]);
    const { addToast, openDrawer, closeDrawer, openConfirmDialog } = useUIStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [newUserCredentials, setNewUserCredentials] = useState<BootstrapCredentials | null>(null);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
    const [showNewCredentialPassword, setShowNewCredentialPassword] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const { user: actor } = useAuthStore();
    const isSupAdminActor = actor?.role === 'supadmin';
    const isAdminActor = actor?.role === 'admin';
    const isRestrictedCompanyAdminActor = actor?.role === 'admin' && !Boolean(actor?.showOnlyCoreAdminPermissions);
    const isCoreAdminActor = actor?.role === 'admin' && Boolean(actor?.showOnlyCoreAdminPermissions);
    const isCompanyAdminActor = isRestrictedCompanyAdminActor || isCoreAdminActor;
    const assignableRoles: UserRole[] = isSupAdminActor ? ['user', 'admin', 'supadmin'] : ['user'];
    const canManageTargetUser = (target: User) =>
        isSupAdminActor || (isCompanyAdminActor ? (target.role === 'user' && !isCompanyAdminLikeUser(target)) : target.role !== 'supadmin');
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
            addToast({
                title: 'Permission Denied',
                message: isAdminActor ? 'Admin can only manage standard user accounts.' : 'Only supadmin can delete a supadmin user.',
                type: 'error'
            });
            return;
        }
        setPendingDeleteId(id);
        const confirmed = await openConfirmDialog({
            title: 'Delete User',
            message: 'Are you sure you want to delete this user?',
            confirmLabel: 'Delete',
            tone: 'danger',
        });
        if (!confirmed) {
            setPendingDeleteId(null);
            return;
        }
        try {
            await api.admin.deleteUser(id);
            await loadData();
            addToast({ title: 'User Deleted', message: 'User removed successfully.', type: 'info' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete user.';
            addToast({ title: 'Error', message, type: 'error' });
        } finally {
            setPendingDeleteId(null);
        }
    };

    const handleSaveUser = async (userData: Partial<User>, isNew: boolean) => {
        const existingUser = !isNew && userData.id ? users.find((u) => u.id === userData.id) : undefined;
        const adminCompanyIds = actor?.companyIds ?? (actor?.companyId ? [actor.companyId] : []);
        const normalizedUserData: Partial<User> = isAdminActor
            ? {
                ...userData,
                role: 'user',
                isGuest: false,
                companyId: userData.companyId && adminCompanyIds.includes(userData.companyId)
                    ? userData.companyId
                    : (adminCompanyIds[0] || ''),
                provisioningSource: existingUser?.provisioningSource || 'external_local_account',
                permissions: userData.permissions || (existingUser?.id ? [] : [...COMPANY_ADMIN_BASE_PERMISSIONS]),
                showOnlyCoreAdminPermissions: false,
            }
            : userData;
        const normalizedEmail = normalizedUserData.email?.trim().toLowerCase();
        if (isAdminActor && adminCompanyIds.length === 0) {
            addToast({ title: 'Permission Denied', message: 'Admin user is not linked to any company.', type: 'error' });
            return;
        }
        if (!normalizedUserData.name?.trim()) {
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
        if (!normalizedUserData.role) {
            addToast({ title: 'Validation Error', message: 'Role is required.', type: 'error' });
            return;
        }
        if (!isSupAdminActor && normalizedUserData.role === 'supadmin') {
            addToast({ title: 'Permission Denied', message: 'Only supadmin can assign supadmin role.', type: 'error' });
            return;
        }
        if (existingUser && !canManageTargetUser(existingUser)) {
            addToast({
                title: 'Permission Denied',
                message: isAdminActor ? 'Admin can only manage standard user accounts.' : 'Only supadmin can edit a supadmin user.',
                type: 'error'
            });
                return;
        }
        const companyRequired = (normalizedUserData.role === 'user' && !normalizedUserData.isGuest) || normalizedUserData.role === 'admin';
        if (companyRequired && !normalizedUserData.companyId) {
            addToast({ title: 'Validation Error', message: 'Company is required for role "user" (non-guest) and "admin".', type: 'error' });
            return;
        }
        const hasCompanyAdminPermissions = Boolean(normalizedUserData.permissions?.includes('manage:users') || normalizedUserData.permissions?.includes('manage:companies'));
        if (normalizedUserData.role === 'user' && hasCompanyAdminPermissions && (!normalizedUserData.companyId || normalizedUserData.isGuest)) {
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
                const { user: newUser, bootstrapCredentials, notifications } = await api.admin.createUser({
                    ...normalizedUserData,
                    email: normalizedEmail,
                } as Omit<User, 'id'>);
                if (Array.isArray(normalizedUserData.companyIds) && newUser?.id &&
                    (normalizedUserData.role === 'admin' || normalizedUserData.role === 'user')) {
                    await api.admin.setAdminUserCompanies(newUser.id, normalizedUserData.companyIds);
                }
                setNewUserCredentials(bootstrapCredentials || null);
                setShowNewCredentialPassword(false);
                await loadData();
                const welcomeEmail = notifications?.welcomeEmail;
                addToast({
                    title: welcomeEmail?.sent === false ? 'User Created, Email Failed' : 'User Created',
                    message: welcomeEmail?.sent === false
                        ? `User was created successfully, but the welcome email could not be sent: ${welcomeEmail.error || 'Unknown mail error.'}`
                        : 'External ID local account created. Share the one-time temporary password securely.',
                    type: welcomeEmail?.sent === false ? 'info' : 'success'
                });
            } else {
                if (!normalizedUserData.id) return;
                const confirmMessage = existingUser
                    ? `Are you sure you want to update ${existingUser.email}?`
                    : 'Are you sure you want to update this user?';
                const confirmed = await openConfirmDialog({
                    title: 'Update User',
                    message: confirmMessage,
                    confirmLabel: 'Update',
                });
                if (!confirmed) return;
                await api.admin.updateUser(normalizedUserData.id, { ...normalizedUserData, email: normalizedEmail });
                if (Array.isArray(normalizedUserData.companyIds) &&
                    (normalizedUserData.role === 'admin' || normalizedUserData.role === 'user')) {
                    await api.admin.setAdminUserCompanies(normalizedUserData.id, normalizedUserData.companyIds);
                }
                await loadData();
                addToast({ title: 'User Updated', message: 'User details saved.', type: 'success' });
            }
            closeDrawer();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Operation failed.';
            addToast({ title: 'Error', message, type: 'error' });
        }
    };

    const openUserDrawer = async (user?: User) => {
        if (user && !canManageTargetUser(user)) {
            addToast({
                title: 'Permission Denied',
                message: isAdminActor ? 'Admin can only manage standard user accounts.' : 'Only supadmin can manage supadmin users.',
                type: 'error'
            });
            return;
        }
        let enrichedUser = user;
        if (user && (user.role === 'admin' || user.role === 'user')) {
            try {
                const companyIds = await api.admin.getAdminUserCompanies(user.id);
                enrichedUser = { ...user, companyIds };
            } catch {
                enrichedUser = user;
            }
        }
        openDrawer(
            <UserForm
                user={enrichedUser}
                companies={companies}
                assignableRoles={assignableRoles}
                isSupAdminActor={isSupAdminActor}
                isCoreAdminActor={isCoreAdminActor}
                isCompanyAdminActor={isCompanyAdminActor}
                actorCompanyId={actor?.companyId || ''}
                actorCompanyIds={actor?.companyIds ?? (actor?.companyId ? [actor.companyId] : [])}
                actorPermissions={actor?.permissions || []}
                availablePermissions={allPermissions}
                analysisReports={analysisReports}
                onSave={async (data) => handleSaveUser(data, !user)}
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
        addToast({
            title: 'Managed by Entra',
            message: `Password reset for ${target.email} must be handled through the Entra hosted reset flow.`,
            type: 'info'
        });
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
                            <th className="px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Identity</th>
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
                                    <div className="flex flex-col gap-1">
                                        <span className="inline-flex w-fit rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                            {getProvisioningLabel(user.provisioningSource)}
                                        </span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {user.identityProviderType || 'external_local'}
                                            {user.identityTenantId ? ` • ${user.identityTenantId}` : ''}
                                        </span>
                                        <span className={`inline-flex w-fit rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                            user.accessState === 'active'
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                                                : user.accessState === 'invited'
                                                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                                                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                                        }`}>
                                            {user.accessState || 'pending'}
                                        </span>
                                    </div>
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
                                        onClick={() => openUserDrawer(user)}
                                        className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:text-slate-300 disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can edit supadmin users' : 'Edit user'}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <AsyncActionButton
                                        onClick={() => handleDelete(user.id)}
                                        isPending={pendingDeleteId === user.id}
                                        loadingMode="spinner-only"
                                        className="text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:text-slate-300 disabled:cursor-not-allowed"
                                        disabled={!canManageTargetUser(user)}
                                        title={!canManageTargetUser(user) ? 'Only supadmin can delete supadmin users' : 'Delete user'}
                                    >
                                        <Trash2 size={16} />
                                    </AsyncActionButton>
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
    isCompanyAdminActor,
    actorCompanyId,
    actorCompanyIds,
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
    isCompanyAdminActor: boolean,
    actorCompanyId: string,
    actorCompanyIds: string[],
    actorPermissions: Permission[],
    availablePermissions: Permission[],
    analysisReports: AnalysisReport[],
    onSave: (data: Partial<User>) => Promise<void>,
    onCancel: () => void
}) => {
    const isCompanyAdminManageablePermission = (permission: Permission): boolean => {
        if (COMPANY_ADMIN_BASE_PERMISSIONS.includes(permission)) return true;
        return isBiReportPermission(permission) && actorPermissions.includes(permission);
    };

    const getBasicPermissionsForContext = (role: UserRole, isGuest: boolean): Permission[] => {
        if (isCompanyAdminActor) return [...COMPANY_ADMIN_BASE_PERMISSIONS];
        if (role === 'supadmin') return getDefaultPermissionsForRole('supadmin');
        if (role === 'admin') return ADMIN_CORE_PERMISSIONS;
        if (role === 'user' && isGuest) return ['submit:rfq', 'create:support-ticket'];
        return ['view:dashboard', 'view:reports', 'create:support-ticket'];
    };

    const getAllowedBasicPermissionsForContext = (role: UserRole, isGuest: boolean): Permission[] => {
        const basic = getBasicPermissionsForContext(role, isGuest);
        if (isCompanyAdminActor) return basic;
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

    const getInitialPermissions = (formUser?: User): Permission[] => {
        if (isCompanyAdminActor) {
            const visibleSelectedPermissions = (formUser?.permissions || []).filter((permission): permission is Permission => isCompanyAdminManageablePermission(permission));
            return typeof formUser?.id === 'string' ? visibleSelectedPermissions : [...COMPANY_ADMIN_BASE_PERMISSIONS];
        }
        return formUser?.permissions || getAllowedBasicPermissionsForContext(formUser?.role || 'user', formUser?.isGuest || false);
    };

    const defaultAdminCompanyId = user?.companyId && actorCompanyIds.includes(user.companyId)
        ? user.companyId
        : (actorCompanyIds[0] || actorCompanyId);

    const [formData, setFormData] = useState<Partial<User>>({
        id: user?.id,
        name: user?.name || '',
        email: user?.email || '',
        role: isCompanyAdminActor ? 'user' : (user?.role || 'user'),
        companyId: isCompanyAdminActor ? defaultAdminCompanyId : (user?.companyId || ''),
        isGuest: isCompanyAdminActor ? false : (user?.isGuest || false),
        status: user?.status || 'Active',
        provisioningSource: user?.provisioningSource || 'external_local_account',
        permissions: getInitialPermissions(user)
    });
    const [showOnlyAdminCorePermissions, setShowOnlyAdminCorePermissions] = useState<boolean>(inferShowOnlyAdminCore(user));
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
        user?.companyIds ?? (user?.companyId ? [user.companyId] : [])
    );
    const [companySearch, setCompanySearch] = useState('');

    const toggleAdminCompany = (companyId: string) => {
        setSelectedCompanyIds((prev) =>
            prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId]
        );
    };

    useEffect(() => {
        const resolvedCompanyId = user?.companyId && actorCompanyIds.includes(user.companyId)
            ? user.companyId
            : (actorCompanyIds[0] || actorCompanyId);
        setFormData({
            id: user?.id,
            name: user?.name || '',
            email: user?.email || '',
            role: isCompanyAdminActor ? 'user' : (user?.role || 'user'),
            companyId: isCompanyAdminActor ? resolvedCompanyId : (user?.companyId || ''),
            isGuest: isCompanyAdminActor ? false : (user?.isGuest || false),
            status: user?.status || 'Active',
            provisioningSource: user?.provisioningSource || 'external_local_account',
            permissions: getInitialPermissions(user)
        });
        setShowOnlyAdminCorePermissions(inferShowOnlyAdminCore(user));
        setSelectedCompanyIds(user?.companyIds ?? (user?.companyId ? [user.companyId] : []));
    }, [actorCompanyId, actorCompanyIds, isCompanyAdminActor, user]);

    const togglePermission = (perm: Permission) => {
        if (isCompanyAdminActor && !isCompanyAdminManageablePermission(perm)) return;
        if (!isSupAdminActor && SUPADMIN_CONTROLLED_PERMISSIONS.includes(perm)) return;
        if (!isSupAdminActor && !isCompanyAdminActor && !actorPermissions.includes(perm)) return;
        setFormData(prev => {
            const perms = prev.permissions || [];
            if (perms.includes(perm)) return { ...prev, permissions: perms.filter(p => p !== perm) };
            return { ...prev, permissions: [...perms, perm] };
        });
    };

    const isPermissionLocked = (perm: Permission): boolean => {
        if (isCompanyAdminActor) return !isCompanyAdminManageablePermission(perm);
        const isSupadminControlled = SUPADMIN_CONTROLLED_PERMISSIONS.includes(perm);
        const actorMissing = !isSupAdminActor && !actorPermissions.includes(perm);
        return !isSupAdminActor && (isSupadminControlled || actorMissing);
    };

    const generalPermissions = availablePermissions.filter((permission) => !permission.startsWith('view:analysis-report:'));
    const visibleGeneralPermissions = generalPermissions.filter((permission) => {
        if (isCompanyAdminActor) return COMPANY_ADMIN_BASE_PERMISSIONS.includes(permission);
        if (isSupAdminActor) return true;
        return actorPermissions.includes(permission) || Boolean((formData.permissions || []).includes(permission));
    });
    const biReportEntries = analysisReports.map((report) => ({
        id: report.id,
        name: report.name,
        permission: report.permissionKey,
    })).filter((entry) => {
        if (isCompanyAdminActor) return actorPermissions.includes(entry.permission);
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
                           value={formData.email} onChange={e => setFormData({
                               ...formData,
                               email: e.target.value
                           })} />
                </div>
                <div className={`grid gap-4 ${isCompanyAdminActor ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {!isCompanyAdminActor && (
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
                    )}
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
                {!isCompanyAdminActor && (
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
                )}

                {formData.role !== 'supadmin' && !formData.isGuest && (
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Companies</label>
                    {(() => {
                        const availableCompanies = isCompanyAdminActor
                            ? companies.filter((c) => actorCompanyIds.includes(c.id))
                            : companies;
                        const filtered = availableCompanies.filter((c) =>
                            !companySearch.trim() ||
                            c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
                            c.id.toLowerCase().includes(companySearch.toLowerCase()) ||
                            (c.dataAreaId || '').toLowerCase().includes(companySearch.toLowerCase())
                        );
                        return (
                            <div className="rounded border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                                <div className="px-2 pt-2">
                                    <input
                                        type="text"
                                        placeholder="Search by name, ID or data area…"
                                        value={companySearch}
                                        onChange={(e) => setCompanySearch(e.target.value)}
                                        className="w-full rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto p-2">
                                    {availableCompanies.length === 0 && (
                                        <p className="text-xs text-slate-400 px-1">No companies available.</p>
                                    )}
                                    {filtered.map((c) => (
                                        <label key={c.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-white dark:hover:bg-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={selectedCompanyIds.includes(c.id)}
                                                onChange={() => toggleAdminCompany(c.id)}
                                                className="accent-blue-600"
                                            />
                                            <span className="text-sm text-slate-800 dark:text-slate-200">{c.name}</span>
                                            {c.dataAreaId && (
                                                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">·{c.dataAreaId}</span>
                                            )}
                                            <span className="ml-auto text-[11px] text-slate-400">{c.type}</span>
                                        </label>
                                    ))}
                                    {companySearch.trim() && filtered.length === 0 && (
                                        <p className="text-xs text-slate-400 px-1">No results for "{companySearch}".</p>
                                    )}
                                </div>
                                {selectedCompanyIds.length > 0 && (
                                    <div className="border-t border-gray-200 dark:border-slate-700 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                        {selectedCompanyIds.length} selected
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                    <p className="mt-1 text-[11px] text-slate-500">
                        {formData.role === 'admin'
                            ? 'Select all companies this admin can manage.'
                            : 'Select all companies this user can access.'}
                    </p>
                </div>
                )}

                {!isCompanyAdminActor && (
                <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    <p className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Company Rules</p>
                    <ul className="mt-2 space-y-1">
                        <li>`supadmin`: Company not required.</li>
                        <li>`admin`: Company required. Scoped to selected company.</li>
                        <li>`user` + `Guest`: Company optional (global access as guest).</li>
                        <li>`user` + non-guest: Company required.</li>
                    </ul>
                </div>
                )}

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
                                const actorMissing = !isSupAdminActor && !isCompanyAdminActor && !actorPermissions.includes(p);
                                const isLocked = isPermissionLocked(p);
                                const hiddenByCoreAdminActor =
                                    !isSupAdminActor &&
                                    !isCompanyAdminActor &&
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
                <AsyncActionButton
                    onClick={async () => {
                        const nextData: Partial<User> = { ...formData };
                        nextData.showOnlyCoreAdminPermissions = !isCompanyAdminActor && formData.role === 'admin' ? showOnlyAdminCorePermissions : false;
                        if (isCompanyAdminActor) {
                            const preservedHiddenPermissions = typeof user?.id === 'string'
                                ? (user.permissions || []).filter((permission): permission is Permission => !isCompanyAdminManageablePermission(permission))
                                : [];
                            nextData.role = 'user';
                            nextData.isGuest = false;
                            nextData.companyId = actorCompanyIds[0] || actorCompanyId;
                            nextData.provisioningSource = user?.provisioningSource || 'external_local_account';
                            nextData.permissions = [
                                ...(formData.permissions || COMPANY_ADMIN_BASE_PERMISSIONS)
                                    .filter((permission): permission is Permission => isCompanyAdminManageablePermission(permission)),
                                ...preservedHiddenPermissions,
                            ];
                        } else if (showOnlyAdminCorePermissions && formData.role === 'admin') {
                            nextData.permissions = (formData.permissions || []).filter((permission) => ADMIN_CORE_PERMISSIONS.includes(permission));
                        }
                        if (nextData.role === 'admin' || (nextData.role === 'user' && !nextData.isGuest)) {
                            nextData.companyIds = selectedCompanyIds;
                            nextData.companyId = selectedCompanyIds[0] || '';
                        }
                        setIsSubmitting(true);
                        try {
                            await onSave(nextData);
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                    isPending={isSubmitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 shadow-md"
                >
                    Save User
                </AsyncActionButton>
            </div>
        </div>

        </>
    );
};

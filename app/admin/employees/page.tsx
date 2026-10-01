'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/auth-context';
import { getUsers, addEmployee, updateEmployee, toggleEmployeeStatus, subscribeToStore } from '@/lib/data/store';
import { UserProfile, Role } from '@/types';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Users, UserPlus, Edit, Shield, CheckCircle, XCircle, Power, Mail, Phone, Building } from 'lucide-react';

export default function AdminEmployeesPage() {
  const { user, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [designation, setDesignation] = useState('Software Engineer');
  const [phone, setPhone] = useState('+91 98400 ');
  const [role, setRole] = useState<Role>('employee');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = () => {
    setUsersList(getUsers());
  };

  useEffect(() => {
    loadUsers();
    const unsub = subscribeToStore(loadUsers);
    return unsub;
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSubmitting(true);
    try {
      const res = await addEmployee({
        full_name: name.trim(),
        email: email.trim(),
        department,
        designation,
        phone,
        role,
        is_active: true,
      });

      if (res.success) {
        success(`Employee "${name}" added successfully.`, 'Employee Created');
        setName('');
        setEmail('');
        setIsAddModalOpen(false);
        loadUsers();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to create employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await updateEmployee(editingUser.id, {
        full_name: editingUser.full_name,
        email: editingUser.email,
        department: editingUser.department,
        designation: editingUser.designation,
        phone: editingUser.phone,
        role: editingUser.role,
      });

      if (res.success) {
        success('Employee updated successfully.', 'Profile Updated');
        setEditingUser(null);
        loadUsers();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, empName: string) => {
    try {
      const res = await toggleEmployeeStatus(id);
      if (res.success) {
        success(res.message, `${empName} Status Updated`);
        loadUsers();
      } else {
        toastError(res.message);
      }
    } catch {
      toastError('Failed to update status.');
    }
  };

  return (
    <AppLayout showRightPanel={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Employee Management Directory
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {usersList.length} Total Users
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Manage team members, assign administrative roles, and activate or deactivate accounts.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="shadow-sm self-start sm:self-auto"
          >
            Add New Employee
          </Button>
        </div>

        {/* Employees Cards / Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {usersList.map((emp) => {
            const isSelf = emp.id === user?.id;

            return (
              <Card key={emp.id} className="p-5 border border-slate-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {emp.full_name[0]}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          emp.role === 'admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {emp.role}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          emp.is_active ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-bold text-slate-900 text-sm">{emp.full_name}</h3>
                    <p className="text-xs text-blue-600 font-medium">{emp.designation}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{emp.department}</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                    <div className="flex items-center gap-2 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{emp.phone || '+91 98400 00000'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setEditingUser(emp)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  {!isSelf && (
                    <button
                      onClick={() => handleToggleStatus(emp.id, emp.full_name)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                        emp.is_active
                          ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'
                          : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      {emp.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Team Member"
        subtitle="Create a new employee profile in OfficeFlow"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Vignesh R"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Work Email"
            type="email"
            placeholder="e.g. employee@dwellvise.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              >
                <option value="Engineering">Engineering</option>
                <option value="Design & Product">Design & Product</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Management">Management</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                System Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
              >
                <option value="employee">Employee (Staff)</option>
                <option value="admin">Admin / Manager</option>
              </select>
            </div>
          </div>

          <Input
            label="Designation / Title"
            placeholder="e.g. Software Engineer"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
          />

          <Input
            label="Mobile Phone"
            placeholder="+91 98400 55667"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      {editingUser && (
        <Modal
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          title={`Edit ${editingUser.full_name}`}
          subtitle="Modify employee information and permissions"
          maxWidth="md"
        >
          <form onSubmit={handleUpdateEmployee} className="space-y-4">
            <Input
              label="Full Name"
              value={editingUser.full_name}
              onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
              required
            />

            <Input
              label="Work Email"
              type="email"
              value={editingUser.email}
              onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Department
                </label>
                <select
                  value={editingUser.department}
                  onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Design & Product">Design & Product</option>
                  <option value="Quality Assurance">Quality Assurance</option>
                  <option value="Management">Management</option>
                  <option value="Human Resources">Human Resources</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  System Role
                </label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as Role })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                >
                  <option value="employee">Employee (Staff)</option>
                  <option value="admin">Admin / Manager</option>
                </select>
              </div>
            </div>

            <Input
              label="Designation"
              value={editingUser.designation}
              onChange={(e) => setEditingUser({ ...editingUser, designation: e.target.value })}
            />

            <Input
              label="Mobile Phone"
              value={editingUser.phone || ''}
              onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
            />

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}

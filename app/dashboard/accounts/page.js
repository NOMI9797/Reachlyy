"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import {
  Plus,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  MessageSquare,
  X,
} from "lucide-react";

// Mock data for LinkedIn accounts
const mockLinkedInAccounts = [
  {
    id: 1,
    email: "husnain.ashfaq3939@gmail.com",
    name: "Husnain Ashfaq",
    avatar: "/api/placeholder/40/40",
    status: "healthy",
    subscription: "trial",
    connectionInvites: 40,
    followUpMessages: 30,
    addedDate: "a day ago",
    tags: [],
    salesNavActive: true,
  },
  // Add more mock accounts as needed
];

const statusConfig = {
  healthy: {
    label: "Healthy",
    color: "success",
    icon: CheckCircle,
    bgColor: "bg-success/10 border-success/20",
    textColor: "text-success",
  },
  warning: {
    label: "Warning",
    color: "warning", 
    icon: AlertCircle,
    bgColor: "bg-warning/10 border-warning/20",
    textColor: "text-warning",
  },
  error: {
    label: "Error",
    color: "error",
    icon: XCircle,
    bgColor: "bg-error/10 border-error/20", 
    textColor: "text-error",
  },
};

const subscriptionConfig = {
  trial: {
    label: "Trial",
    color: "warning",
    bgColor: "bg-warning/10 border-warning/20",
    textColor: "text-warning",
  },
  premium: {
    label: "Premium", 
    color: "success",
    bgColor: "bg-success/10 border-success/20",
    textColor: "text-success",
  },
  basic: {
    label: "Basic",
    color: "info",
    bgColor: "bg-info/10 border-info/20", 
    textColor: "text-info",
  },
};

export default function AccountsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accounts] = useState(mockLinkedInAccounts);
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const accountsPerPage = 10;

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/");
    }
  }, [session, status, router]);

  const filteredAccounts = accounts;

  const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
  const startIndex = (currentPage - 1) * accountsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, startIndex + accountsPerPage);

  const handleSelectAccount = (accountId) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSelectAll = () => {
    if (selectedAccounts.length === paginatedAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(paginatedAccounts.map(account => account.id));
    }
  };


  if (status === "loading") {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg text-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-100 flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeSection="accounts"
      />

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      } flex flex-col`}>
        {/* Top Bar */}
        <TopBar title="Accounts" />

        {/* Content Area */}
        <div className="flex-1 p-6">
          {/* LinkedIn Tab */}
          <div className="mb-6">
            <div className="flex items-center gap-4 border-b border-base-300">
              <button className="flex items-center gap-2 px-4 py-3 border-b-2 border-primary text-primary font-medium">
                <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">in</span>
                </div>
                LinkedIn
              </button>
            </div>
          </div>

          {/* Add Account Button */}
          <div className="mb-6">
            <button 
              className="btn btn-primary gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Account
            </button>
          </div>


          {/* Pagination Controls */}
          <div className="flex items-center justify-end mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/60">
                {startIndex + 1} / {Math.min(startIndex + accountsPerPage, filteredAccounts.length)} of {filteredAccounts.length}
              </span>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="px-3 py-1 text-sm font-medium bg-primary text-primary-content rounded">
                  {currentPage}
                </span>
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              
              <select className="select select-bordered select-sm">
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="card bg-base-100 border border-base-300 overflow-hidden">
            {/* Table Header */}
            <div className="bg-base-200 px-6 py-4 border-b border-base-300">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium text-base-content/70 uppercase tracking-wider">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedAccounts.length === paginatedAccounts.length && paginatedAccounts.length > 0}
                    onChange={handleSelectAll}
                    className="checkbox checkbox-sm"
                  />
                </div>
                <div className="col-span-3">Account Info</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Daily Limits</div>
                <div className="col-span-2">Tags</div>
                <div className="col-span-2">Action</div>
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-base-300">
              {paginatedAccounts.map((account) => {
                const statusInfo = statusConfig[account.status];
                const subInfo = subscriptionConfig[account.subscription];
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div key={account.id} className="px-6 py-4 hover:bg-base-50 transition-colors">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Selection */}
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(account.id)}
                          onChange={() => handleSelectAccount(account.id)}
                          className="checkbox checkbox-sm"
                        />
                      </div>

                      {/* Account Info */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {account.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                              account.salesNavActive ? 'bg-success' : 'bg-base-300'
                            }`}>
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          </div>
                          
                          <div className="min-w-0">
                            <div className="font-medium text-base-content truncate">
                              {account.email}
                            </div>
                            <div className="text-sm text-base-content/60 truncate">
                              {account.name}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-base-content/40">
                                Added {account.addedDate}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                       {/* Status */}
                       <div className="col-span-2">
                         <div className="space-y-2">
                           <div className="flex items-center gap-2">
                             <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.bgColor} ${statusInfo.textColor}`}>
                               <StatusIcon className="h-3 w-3" />
                               Account - {statusInfo.label}
                             </div>
                           </div>
                           <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${subInfo.bgColor} ${subInfo.textColor}`}>
                             Subscription - {subInfo.label}
                           </div>
                         </div>
                       </div>

                      {/* Daily Limits */}
                      <div className="col-span-2">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-base-content/60">Connection invites</span>
                            <span className="font-medium">{account.connectionInvites}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-base-content/60">Follow-up Messages</span>
                            <span className="font-medium">{account.followUpMessages}</span>
                          </div>
                        </div>
                        <button className="btn btn-outline btn-xs mt-2 gap-1">
                          <Settings className="h-3 w-3" />
                          Configure Daily Limits
                        </button>
                      </div>

                      {/* Tags */}
                      <div className="col-span-2">
                        <button className="btn btn-outline btn-sm gap-2">
                          <Plus className="h-3 w-3" />
                          New Tag
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <button className="btn btn-ghost btn-sm btn-circle" title="View Details">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-circle" title="Edit">
                            <Edit className="h-4 w-4" />
                          </button>
                           <div className="dropdown dropdown-end">
                             <button className="btn btn-ghost btn-sm btn-circle" title="More actions">
                               <MoreHorizontal className="h-4 w-4" />
                             </button>
                             <ul className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300">
                               <li><a className="text-sm gap-2"><Users className="h-4 w-4" />Manage Connections</a></li>
                               <li><a className="text-sm gap-2"><MessageSquare className="h-4 w-4" />View Messages</a></li>
                               <li><a className="text-sm gap-2"><Settings className="h-4 w-4" />Account Settings</a></li>
                               <li><hr className="my-1" /></li>
                               <li><a className="text-sm text-error gap-2"><Trash2 className="h-4 w-4" />Remove Account</a></li>
                             </ul>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {filteredAccounts.length === 0 && (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-base-content/40" />
                </div>
                <h3 className="text-lg font-medium text-base-content mb-2">No accounts found</h3>
                <p className="text-base-content/60 mb-4">
                  Get started by connecting your first LinkedIn account
                </p>
                <button 
                  className="btn btn-primary gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add LinkedIn Account
                </button>
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {filteredAccounts.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-base-content/60">
                Showing {startIndex + 1} to {Math.min(startIndex + accountsPerPage, filteredAccounts.length)} of {filteredAccounts.length} results
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm"
                >
                  First
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`btn btn-sm ${
                          currentPage === page ? 'btn-primary' : 'btn-ghost'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm"
                >
                  Next
                </button>
                <button 
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

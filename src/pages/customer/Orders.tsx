import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Order } from '../../types';
import { Card } from '../../components/ui/Card';
import { useUIStore } from '../../store/uiStore';
import { Filter, Download, MoreVertical, Truck } from 'lucide-react';

export const CustomerOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { openDrawer } = useUIStore();

  useEffect(() => {
    api.customer.getOrders().then(setOrders);
  }, []);

  const handleRowClick = (order: Order) => {
    openDrawer(
      <div className="space-y-6">
        <div>
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</span>
           <p className="text-xl font-bold text-slate-900 dark:text-white">{order.id}</p>
        </div>
        <div className="flex items-center space-x-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800/30">
             <Truck className="text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
             <div>
                 <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Vessel: {order.vesselName}</p>
                 <p className="text-xs text-blue-700 dark:text-blue-300">Port: {order.port}</p>
             </div>
        </div>
        <div>
           <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Timeline</h3>
           <div className="border-l-2 border-slate-200 dark:border-slate-700 ml-2 space-y-6 pl-6 py-2">
               <div className="relative">
                   <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></div>
                   <p className="text-sm font-medium dark:text-slate-200">Order Placed</p>
                   <p className="text-xs text-slate-500">Oct 01, 2023 - 10:00 AM</p>
               </div>
               <div className="relative">
                   <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-green-500 border-2 border-white dark:border-slate-900"></div>
                   <p className="text-sm font-medium dark:text-slate-200">Approved by Tech Supt.</p>
                   <p className="text-xs text-slate-500">Oct 01, 2023 - 02:30 PM</p>
               </div>
               <div className="relative">
                   <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${order.status === 'In Transit' || order.status === 'Delivered' ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                   <p className="text-sm font-medium dark:text-slate-200">Dispatched</p>
                   <p className="text-xs text-slate-500">Pending</p>
               </div>
           </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 dark:text-slate-300">
             <div className="flex justify-between mb-2">
                 <span className="text-sm text-slate-600 dark:text-slate-400">Subtotal</span>
                 <span className="font-medium text-slate-900 dark:text-white">{order.amount} {order.currency}</span>
             </div>
             <div className="flex justify-between mb-2">
                 <span className="text-sm text-slate-600 dark:text-slate-400">Tax</span>
                 <span className="font-medium text-slate-900 dark:text-white">0.00 {order.currency}</span>
             </div>
             <div className="flex justify-between font-bold text-lg dark:text-white">
                 <span>Total</span>
                 <span>{order.amount} {order.currency}</span>
             </div>
        </div>
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800';
        case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800';
        case 'In Transit': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
        case 'Cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
        default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Management</h1>
        <div className="flex space-x-2">
             <button className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200">
                <Filter size={16} strokeWidth={1.5} /> <span>Filter</span>
             </button>
             <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 shadow-sm shadow-blue-500/20">
                <Download size={16} strokeWidth={1.5} /> <span>Export</span>
             </button>
        </div>
      </div>

      <Card className="overflow-hidden" noPadding>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-800">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vessel</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
            {orders.map((order) => (
              <tr 
                key={order.id} 
                onClick={() => handleRowClick(order)}
                className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors even:bg-slate-50/30 dark:even:bg-slate-900/30"
              >
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{order.id}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{order.vesselName}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{order.port}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{order.date}</td>
                <td className="px-6 py-4 text-slate-900 dark:text-slate-200 font-mono tracking-tight">{order.currency} {order.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <MoreVertical size={16} strokeWidth={1.5} />
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

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import type { ActivityLogEntry } from '../../types';

interface ActivityLogProps {
  domain?: string;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ domain }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = db.collection("activityLogs").orderBy("timestamp", "desc").limit(100);
    
    const unsubscribe = q.onSnapshot((querySnapshot) => {
      const logsData: ActivityLogEntry[] = [];
      querySnapshot.forEach((doc) => {
        logsData.push({ ...doc.data(), id: doc.id } as ActivityLogEntry);
      });
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activity logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredLogs = useMemo(() => {
      if (!domain) return logs;
      return logs.filter(log => 
          log.performedBy.email.endsWith(`@${domain}`) || 
          (log.targetUser && log.targetUser.email.endsWith(`@${domain}`))
      );
  }, [logs, domain]);

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };
  
  if (loading) {
    return <div className="flex justify-center items-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Activity Log {domain ? `for ${domain}` : ''}</h2>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-200">
            {filteredLogs.length === 0 ? (
                 <div className="text-center py-10 text-slate-500">No activity logs found.</div>
            ) : (
                filteredLogs.map(log => (
                    <div key={log.id} className="p-4">
                        <div className="flex justify-between items-start">
                            <p className="font-medium text-slate-900">{log.action}</p>
                            <p className="text-xs text-slate-500 whitespace-nowrap">{formatTimestamp(log.timestamp)}</p>
                        </div>
                        <div className="mt-2 text-sm text-slate-600 space-y-1">
                            <p><strong className="font-medium text-slate-700">By:</strong> {log.performedBy.email}</p>
                            <p><strong className="font-medium text-slate-700">Target:</strong> {log.targetUser?.email || 'N/A'}</p>
                            <p><strong className="font-medium text-slate-700">Details:</strong> {log.details}</p>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Performed By</th>
                <th className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Target User</th>
                <th className="px-5 py-3 border-b-2 border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-5 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-900 whitespace-nowrap">{formatTimestamp(log.timestamp)}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-900 whitespace-no-wrap font-medium">{log.action}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-600 whitespace-no-wrap">{log.performedBy.email}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-600 whitespace-no-wrap">{log.targetUser?.email || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-5 border-b border-slate-200 bg-white text-sm">
                      <p className="text-slate-900 whitespace-no-wrap">{log.details}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
